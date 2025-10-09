# Compatibility System (`src/compat/`) - Machine/Garment Matching

This module provides a pure, testable API for compatible machine/garment matching with accent-insensitive label normalization and scenario Map/Object support.

## 🏗️ Architecture

```
src/compat/
├── index.js                 # Public API exports
├── normalize.js            # Label normalization & synonyms
├── labels.js               # Scenario label extraction & job specs
├── scenarios.js            # Map/Object scenario access
├── rules.js                # Compatibility logic & reasons
├── __tests__/              # Comprehensive unit tests
└── README.md               # This documentation
```

## 🚀 Quick Start

```javascript
import {
  buildNeededSet,
  computeMachineCompatibility,
  getScenarioForMachine,
  listScenarioMachineIds
} from 'compat';

// Get required labels from form data
const needed = buildNeededSet(formData); // Set('garment', 'location')

// Check each machine compatibility
for (const machine of machines) {
  const scenario = getScenarioForMachine(scenarioByMachineId, machine.id);
  const result = computeMachineCompatibility(machine, scenario, needed, {
    largeurMm: formData.largeurMm,
    hauteurMm: formData.hauteurMm,
    nbCouleurs: formData.nbCouleurs
  });

  if (result.ok) {
    // Compatible machine
    console.log(`${machine.nom}: ${result.matched.join(', ')}`);
  } else {
    // Incompatible - show reasons
    console.log(`${machine.nom}: ${result.reasons[0].message}`);
  }
}
```

## 📋 API Reference

### `buildNeededSet(job)`

Extract and normalize garment types needed for compatibility.

```javascript
const needed = buildNeededSet({
  types: ['T-shirt', 'Devant'],        // Array
  // or
  types: 't-shirt, coeur'             // String
});
// → Set('t-shirt', 'devant')
```

### `extractScenarioLabels(scenario)`

Extract normalized labels from machine scenario data.

```javascript
const labels = extractScenarioLabels(scenario);
// → Set('t-shirt', 'devant', 'bonnet')
```

### `computeMachineCompatibility(machine, scenario, needed, jobConstraints)`

Compute detailed compatibility result with structured reasons.

```javascript
const result = computeMachineCompatibility(machine, scenario, needed, {
  largeurMm: 400,
  hauteurMm: 500,
  nbCouleurs: 8
});

if (result.ok) {
  console.log(`Compatible: ${result.matched.join(', ')}`);
} else {
  console.log(`Incompatible: ${result.reasons.map(r => r.message).join('; ')}`);
}
```

### `listScenarioMachineIds(scenarioByMachineId)`

Extract machine IDs from scenario mapping (Map or Object).

```javascript
const ids = listScenarioMachineIds(scenarioByMachineId);
// Supports both Map<machineId, scenario> and {machineId: scenario}
```

### `getScenarioForMachine(scenarioByMachineId, machineId, fallback)`

Retrieve scenario for specific machine.

```javascript
const scenario = getScenarioForMachine(
  scenarioByMachineId,
  'machine-123',
  defaultScenario // optional fallback
);
```

### Label Normalization

```javascript
import { normalizeLabel, SYNONYMS } from 'compat';

// Normalize individual labels
normalizeLabel('Tee Shirt cœur!') === 't-shirt-coeur';

// Check synonym mappings
SYNONYMS.get('tshirt') === 't-shirt';
SYNONYMS.get('cœur') === 'coeur';
```

## 🔧 Data Formats

### Machine Object
```javascript
const machine = {
  id: 'machine-123',
  nom: 'Machine Malerco',
  nbTetes: 12,              // Head count (6 or 12)
  maxCouleurs: 16,          // Max colors allowed
  champLargeurMm: 400,      // Max width
  champHauteurMm: 500,      // Max height
  tempsChangementCouleurMin: 2
};
```

### Scenario Object
```javascript
const scenario = {
  id: 'scenario-456',
  etiquettes: ['bonnet', 'devant'], // Or string: "bonnet devant"
  _labels: ['bonnet', 'devant'],     // Pre-computed (faster)
  dureeBroderieMinutes: 30,
  // ... other timing data
};
```

### Job Constraints
```javascript
const jobSpec = {
  largeurMm: 350,           // Job width requirement
  hauteurMm: 450,           // Job height requirement
  nbCouleurs: 12            // Color count requirement
};
```

## ⚖️ Compatibility Rules

### ✅ Label Matching
- All required garment types must be present in machine scenario
- Case/Accent/Diacritic insensitive matching
- Synonym resolution (tshirt → t-shirt, cœur → coeur)
- Strict Set intersection logic

### ✅ Machine Constraints
- Job dimensions ≤ machine field limits
- Color count ≤ machine max colors
- Graceful handling of undefined constraints

### ✅ Special Rules
**Anti-Compatible Logic**: If job requires "coeur" but machine only provides "anti-coeur", incompatible:
```javascript
// Job: ["coeur"] + Machine labels: ["t-shirt", "anti-coeur"]
// Reason: "anti-coeur ne couvre pas coeur"
```

### ❌ Incompatibility Reasons

Structured compatibility results provide detailed explanation:

```javascript
const result = {
  ok: false,
  reasons: [
    {
      code: 'MISSING_LABEL',
      label: 't-shirt',
      message: 'Étiquette manquante: "t-shirt"'
    },
    {
      code: 'WIDTH_EXCEEDED',
      job: 500,
      machine: 400,
      message: 'Largeur 500mm > limite machine 400mm'
    }
  ],
  matched: ['devant'],
  missing: ['t-shirt'],
  machineId: 'machine-123'
};
```

## 🧪 Testing

```bash
# Run compatibility tests
npm test src/compat/__tests__/

# Test individual functions
npm test -- --run normalize.test.js
```

### Test Coverage
- ✅ Label normalization (accents, synonyms, punctuation)
- ✅ Set/Array/String input handling
- ✅ Map vs Object scenario access
- ✅ All compatibility rules and constraints
- ✅ Edge cases (null/undefined/malformed data)

## 🔄 Migration Guide

### From Scattered Logic
```javascript
// OLD: Scattered compatibility code
const neededTypes = toLabelArray(formData?.types || []);
const normalizedTypes = neededTypes.map(t => normalizeLabel(t));
const scenLabels = scenario.etiquettes ? JSON.parse(scenario.etiquettes) : [];
for (const required of normalizedTypes) {
  if (!scenLabels.includes(required)) {
    // incompatible logic...
  }
}
```

### To Centralized API
```javascript
// NEW: Single source of truth
const needed = buildNeededSet(formData);
const labels = extractScenarioLabels(scenario);
const result = computeMachineCompatibility(machine, scenario, needed, jobSpec);
```

## 🚀 Performance Notes

- **Set Operations**: O(1) lookups for label matching
- **Memoization Ready**: Pure functions support React memoization
- **No JSON.parse**: Direct array access when _labels available
- **Backward Compatible**: Works with existing scenario data structures

## 🛠️ Development

### Adding New Synonyms
```javascript
// In normalize.js SYNONYMS
'newvariant': 'standard', // "new variant" → "standard"
```

### Adding New Compatibility Rules
```javascript
// In rules.js computeMachineCompatibility
// Add new constraint e.g., machine speed limits
if (scenario.minVitessePpm) {
  // Check job vs machine speed compatibility
}
```

### Extending Reason Types
```javascript
// Add new reason codes to CompatReason interface
{
  code: 'SPEED_INADEQUATE',
  job: requiredSpeed,
  machine: machineSpeed,
  message: `Vitesse requise ${requiredSpeed}ppm > machine ${machineSpeed}ppm`
}
```

---

## 📈 Benefits

- **🔧 Maintainable**: Single source of truth for compatibility logic
- **🧪 Testable**: Pure functions, full test coverage
- **🚀 Performant**: Set operations, memoization-friendly
- **🛡️ Reliable**: No "is not iterable" errors, Map/Object agnostic
- **🎯 Accurate**: Proper label normalization, synonym handling
- **📱 Reactive**: Hook-stable for React component integration
