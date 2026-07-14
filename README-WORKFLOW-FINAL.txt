MOVENTRA — Workflow finalisé

Corrections principales :
- Les devis acceptés créent une facture brouillon avec les mêmes données et des champs uniformisés.
- La facture manuelle reste disponible.
- Une facture déjà envoyée ou payée crée une révision R1, R2, etc. lors d’une modification.
- Les suppléments de clôture recalculent le sous-total, TPS, TVQ et total.
- La mission pointe vers la nouvelle révision active.
- Le montant payé, le solde et les paiements sont conservés.
- Un dossier DOS-... relie soumission, devis, facture et historique.
- La collection historique enregistre création, acceptation, révision, clôture et paiement.

Important : publier aussi firestore.rules dans Firebase.
