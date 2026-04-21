Cada actuación de implementación se debe llevar hacer usando el flujo de trabajo GitHub Flow:

• Con el agente en modo Plan, elaboramos un plan de implementación del issue que queremos
implementar. Cuando lo tengamos finalizado, cambiamos a modo Agente.
• Pedimos al agente que cree un issue en el repo remoto GitHub con el contenido del plan.
• Pedimos al agente que cree una rama (branch) git para llevar a cabo la implementación del issue.
• Pedimos al agente que confirme cambios (commit) en local y suba (push) la nueva rama al repo remoto.
• Finalmente, pedimos al agente que cierre el issue fusionando (merge) la nueva rama a la rama main y
que sincronice (push) con origin/main. Si no somos los propietarios del repo remoto, le pediremos que
cree una PR (Pull Request) con la nueva rama. El propietario del repo remoto deberá revisar la PR y
fusionarla con main para cerrar el issue.

Actualizar PRD.md, architecture.md, data_model.md y APPLICATION.md siempre después de finalizar la implementación de un issue.