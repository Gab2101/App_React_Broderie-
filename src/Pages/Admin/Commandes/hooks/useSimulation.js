// src/Pages/Admin/Commandes/hooks/useSimulation.js
import { useMemo, useState } from "react";
import { calculerDurees } from "../../../../utils/calculs";
import {snapToNextWorkStart,addMinutesWithinWorkHours,roundUpToNextHourParis,DEFAULT_WORKDAY,} from "../utils/workhours";
import { computeNettoyageSecondsForOrder } from "../../../../utils/nettoyageRules";
import { toLabelArray, toNormalizedSet, normalizeLabel } from '../utils/labels';
import { roundMinutesTo5 } from "../utils/timeRealtime";
import { getLinkedLastFinishAndMachineId } from "../utils/linked";

export default function useSimulation(opts = {}) {
  const { formData: rawFormData, ...rest } = opts ?? {}
  const formData = rawFormData ?? {}

  const {
    machines,
    planning,
    nettoyageRules,
    articleTags,
    linked: { isLinked, linkedCommandeId, sameMachineAsLinked, startAfterLinked } = {}
  } = rest
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [machineAssignee, setMachineAssignee] = useState(null);

  // Coef final appliqué à la toute fin (ex: 350 => x3.5 du temps)
  const [confirmCoef, setConfirmCoef] = useState(200);

  // Nombre de mono utilisées en parallèle (1..n) quand la machine a nbTetes = 1
  const [monoUnitsUsed, setMonoUnitsUsed] = useState(1);

  // Lance une simulation pour toutes les machines compatibles
  const handleSimulation = async (freshFormData) => {
    // Use fresh form data if provided, otherwise fall back to hook data
    const currentFormData = freshFormData || formData;

    // CRITICAL FIX: Use normalized Sets for case-insensitive matching
    const neededTypesSet = toNormalizedSet(toLabelArray(currentFormData.types));
    const neededOptionsSet = toNormalizedSet(toLabelArray(currentFormData.options));

    // Process machine labels - PostgreSQL stores them as JSON strings
    const machinesWithLabels = machines.map((m) => {
      // Parse JSON string to array, handle backwards compatibility
      let etiquettesArray;
      try {
        // PostgreSQL stores arrays as JSON strings in Supabase
        etiquettesArray = JSON.parse(m.etiquettes || '[]');
      } catch (e) {
        // Legacy fallback: assume it's already an array
        etiquettesArray = Array.isArray(m.etiquettes) ? m.etiquettes : [];
      }

      // Normalize and deduplicate labels
      const normalizedLabels = etiquettesArray.map(normalizeLabel).filter(n => n);
      const labelSet = new Set(normalizedLabels);

      return {
        ...m,
        _labels: labelSet,
      };
    });

    // Gestion éventuelle du chaînage
    let debutMinOverride = null;
    if (isLinked && linkedCommandeId) {
      const linkedIdNum = Number(linkedCommandeId);
      const { lastFinish } = getLinkedLastFinishAndMachineId(planning, linkedIdNum);
      if (startAfterLinked) {
        debutMinOverride = lastFinish
        ? snapToNextWorkStart(lastFinish, DEFAULT_WORKDAY)
        : roundUpToNextHourParis(new Date());
      }
      // si sameMachineAsLinked === true, la contrainte machine sera choisie en modale
    }

    // Compat strict (types + options), sinon fallback (types)
    const compatiblesStrict = machinesWithLabels.filter((m) => {
      // Use Set.has() for proper normalized matching (case insensitive!)
      const hasTypes = Array.from(neededTypesSet).every(t => m._labels.has(t));
      const hasOptions = Array.from(neededOptionsSet).every(o => m._labels.has(o));

      return hasTypes && hasOptions;
    });

    const compatiblesFallback = machinesWithLabels.filter((m) =>
      // Fallback to types only, using Set.has() as well
      Array.from(neededTypesSet).every(t => m._labels.has(t))
    );

    const compatibles = compatiblesStrict.length > 0 ? compatiblesStrict : compatiblesFallback;

    // Debug info available for troubleshooting if needed
    const debugInfo = process.env.NODE_ENV === 'development' ? {
      rawTypes: formData.types,
      rawOptions: formData.options,
      normalizedTypes: Array.from(neededTypesSet),
      normalizedOptions: Array.from(neededOptionsSet),
      compatiblesStrictCount: compatiblesStrict.length,
      compatiblesCount: compatibles.length,
      machinesLabels: machinesWithLabels.map(m => ({ id: m.id, nom: m.nom, raw: Array.from(toLabelArray(m.etiquettes)), normalized: Array.from(m._labels) })),
      compatiblesLabels: compatibles.map(m => ({ id: m.id, nom: m.nom, labels: Array.from(m._labels) }))
    } : null;

    if (compatibles.length === 0) {
      alert("Aucune machine compatible. Vérifie 'types' / 'options' (casse/espaces).");
      return;
    }

    const scenariosLocaux = [];

    for (const m of compatibles) {
      const now = Date.now();
      const planifies = (planning || [])
        .filter((p) => p.machineId === m.id && new Date(p.fin).getTime() >= now)
        .sort((a, b) => new Date(a.debut) - new Date(b.debut));

      const nowDispo = roundUpToNextHourParis(new Date());
      const lastFin = planifies.length ? new Date(planifies[planifies.length - 1].fin) : null;
      const anchorBase = lastFin && lastFin > nowDispo ? lastFin : nowDispo;
      const anchor = debutMinOverride && debutMinOverride > anchorBase ? debutMinOverride : anchorBase;

      const debut = snapToNextWorkStart(anchor, DEFAULT_WORKDAY);

      // Nettoyage par article (secondes)
      const etiquetteArticle = currentFormData.types?.[0] || null;
      const nettoyageParArticleSec = computeNettoyageSecondsForOrder(
        etiquetteArticle,
        currentFormData.options,
        nettoyageRules,
        articleTags
      );

      // ---- Calcul brut des durées (broderie + nettoyage) pour CETTE machine ----
      // NB: ici on utilise m.nbTetes (1 pour une mono). Le parallélisme de plusieurs mono
      // sera appliqué plus tard via monoUnitsUsed.
      const { dureeBroderieHeures, dureeNettoyageHeures, dureeTotaleHeures } = calculerDurees({
        quantite: Number(currentFormData.quantite || 0),
        points: Number(currentFormData.points || 0),
        vitesse: Number(currentFormData.vitesseMoyenne || 680), // stitches/min machine
        nbTetes: Number(m.nbTetes || 1),
        nettoyageParArticleSec,
      });

      // -> On ne fait AUCUN arrondi ici. On garde la valeur continue.
      const dureeTotaleHeuresReelle = Number(dureeTotaleHeures || 0);

      // Pour positionner une fin "théorique", on peut arrondir à l'heure supérieure.
      const dureeTotaleHeuresArrondie = Math.ceil(dureeTotaleHeuresReelle);
      const { end: fin } = addMinutesWithinWorkHours(
        debut,
        dureeTotaleHeuresArrondie * 60,
        DEFAULT_WORKDAY
      );

      scenariosLocaux.push({
        machine: m,
        debut,
        fin,
        dureeBroderieHeures,
        dureeNettoyageHeures,
        // Valeur CONTINUE sans arrondi (servira aux minutes théoriques)
        dureeTotaleHeuresReelle,
        // Valeur arrondie à l'heure pour afficher une fin "propre" dans la liste
        dureeTotaleHeuresArrondie,
      });
    }

    // Choisit le scénario qui finit le plus tôt
    scenariosLocaux.sort((a, b) => a.fin - b.fin);
    const meilleur = scenariosLocaux[0];

    setScenarios(scenariosLocaux);
    setSelectedScenario(meilleur);
    setMachineAssignee(meilleur.machine.id);
    setConfirmCoef(200);
    setMonoUnitsUsed(1); // reset quand on relance une simulation
  };

  // Map idMachine -> scenario
  const scenarioByMachineId = useMemo(() => {
    const map = new Map();
    for (const sc of scenarios) map.set(sc.machine.id, sc);
    return map;
  }, [scenarios]);

  // Scénario courant (celui choisi ou celui assigné)
  const currentScenario = useMemo(() => {
    const sc = machineAssignee != null ? scenarioByMachineId.get(Number(machineAssignee)) : selectedScenario;
    return sc || selectedScenario;
  }, [scenarioByMachineId, machineAssignee, selectedScenario]);

  // ---- Minutes théoriques continues (sans arrondi prématuré) ----
  // - Conversion heures -> minutes en conservant les décimales
  // - Si machine mono: division par monoUnitsUsed (parallélisme de plusieurs machines mono)
  const minutesTheoriques = useMemo(() => {
    if (!currentScenario) return 0;

    const h = Number(currentScenario.dureeTotaleHeuresReelle || 0);
    const minutesContinu = h * 60; // PAS d'arrondi ici

    const isMono = Number(currentScenario?.machine?.nbTetes || 1) === 1;
    const factor = isMono ? Math.max(1, Number(monoUnitsUsed || 1)) : 1;

    // Plusieurs mono en parallèle => on divise le temps
    const minutesParallele = minutesContinu / factor;

    return minutesParallele; // valeur flottante
  }, [currentScenario, monoUnitsUsed]);

  // ---- Application du COEF à la toute fin + arrondi final ----
  // confirmCoef est un pourcentage : 350 => x3.5
  const minutesReellesAppliquees = useMemo(() => {
    const coefFactor = Number(confirmCoef || 100) / 100; // 350 -> 3.5
    const minutesAvecCoef = minutesTheoriques * coefFactor;

    // On arrondit à la minute entière, puis au pas de 5 min
    const minutesEntieres = Math.round(minutesAvecCoef);
    return roundMinutesTo5(minutesEntieres);
  }, [minutesTheoriques, confirmCoef]);

  return {
    scenarios,
    selectedScenario,
    setSelectedScenario,
    machineAssignee,
    setMachineAssignee,
    confirmCoef,
    setConfirmCoef,
    scenarioByMachineId,
    currentScenario,
    minutesReellesAppliquees,
    monoUnitsUsed,
    setMonoUnitsUsed,
    handleSimulation,
  };
}
