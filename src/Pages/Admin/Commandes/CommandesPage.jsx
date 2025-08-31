@@ .. @@
      {/* 2) Confirmation mono — jamais si un flux multi est actif */}
      <MachineAndTimeConfirmModal
        isOpen={isConfirmOpen && creationFlow !== "multi"}
        onClose={() => !isSubmitting && setIsConfirmOpen(false)}
        machines={machines}
        formData={form.formData}
        selectedScenario={sim.selectedScenario}
        scenarioByMachineId={sim.scenarioByMachineId}
        currentScenario={sim.currentScenario}
        confirmCoef={sim.confirmCoef}
        setConfirmCoef={sim.setConfirmCoef}
        minutesReellesAppliquees={sim.minutesReellesAppliquees}
        machineAssignee={sim.machineAssignee}
        setMachineAssignee={sim.setMachineAssignee}
        monoUnitsUsed={sim.monoUnitsUsed}
        setMonoUnitsUsed={sim.setMonoUnitsUsed}
-        onConfirm={({ machineId, coef, monoUnitsUsed }) =>
-          handleConfirmCreation({ machineId, coef, monoUnitsUsed })
-        }
+        onConfirm={({ machineId, coef, monoUnitsUsed, assignation }) =>
+          handleConfirmCreation({ machineId, coef, monoUnitsUsed, assignation })
+        }
      />