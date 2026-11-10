import type { TranslationKey } from './en';

export const fr: Record<TranslationKey, string> = {
  'app.name': 'Plateforme Événementielle',
  'common.loading': 'Chargement…',
  'common.error': 'Une erreur est survenue.',
  'common.retry': 'Réessayer',
  'common.save': 'Enregistrer',
  'common.saving': 'Enregistrement…',
  'common.cancel': 'Annuler',
  'common.search': 'Rechercher',
  'common.empty': 'Rien pour le moment.',
  'common.required': 'Ce champ est obligatoire.',

  'nav.dashboard': 'Tableau de bord',
  'nav.events': 'Événements',
  'nav.team': 'Équipe',
  'nav.branding': 'Identité visuelle',
  'nav.access': 'Accès',
  'nav.reports': 'Rapports',
  'nav.signOut': 'Déconnexion',
  'nav.backToSite': 'Retour au site public',

  'auth.title': 'Connexion',
  'auth.registerTitle': 'Créer un compte',
  'auth.email': 'Adresse e-mail',
  'auth.password': 'Mot de passe',
  'auth.displayName': 'Nom complet',
  'auth.signIn': 'Se connecter',
  'auth.signingIn': 'Connexion…',
  'auth.createAccount': 'Créer un compte',
  'auth.needAccount': 'Besoin d’un compte ?',
  'auth.haveAccount': 'Vous avez déjà un compte ?',
  'auth.checkEmail':
    'Consultez votre e-mail pour confirmer votre adresse, puis connectez-vous.',
  'auth.forgotPassword': 'Mot de passe oublié ?',

  'workspace.dashboard.title': 'Espace de travail',
  'workspace.dashboard.subtitle':
    'Votre organisation, vos événements et vos rapports au même endroit.',
  'workspace.onboarding': 'Terminez la configuration de votre espace',
  'workspace.branding.title': 'Identité visuelle',
  'workspace.branding.subtitle':
    'Ces valeurs s’appliquent à votre espace, aux pages publiques et aux badges.',
  'workspace.branding.contrastWarning':
    'Contraste inférieur à {required}:1 pour {pair} (actuellement {ratio}:1). Le texte peut être difficile à lire.',
  'workspace.branding.saved': 'Identité visuelle enregistrée.',

  'events.title': 'Événements',
  'events.new': 'Nouvel événement',
  'events.empty':
    'Aucun événement pour l’instant. Créez votre premier événement pour commencer.',
  'events.name': 'Nom de l’événement',
  'events.slug': 'Adresse web',
  'events.format': 'Format',
  'events.visibility': 'Visibilité',
  'events.timeZone': 'Fuseau horaire',
  'events.startsAt': 'Début',
  'events.endsAt': 'Fin',
  'events.venue': 'Lieu',
  'events.status': 'Statut',
  'events.publish': 'Publier l’événement',
  'events.published': 'Publié',
  'events.create': 'Créer un brouillon',
  'events.creating': 'Création…',
  'events.modules': 'Modules activés',
  'events.details.title': 'Détails de l’événement',

  'access.title': 'Accès des membres',
  'access.subtitle':
    'Choisissez un membre pour voir ses capacités effectives et accorder ou révoquer un accès direct.',
  'access.entitlement':
    'Votre organisation dispose de {granted} capacités sur {total} dans le catalogue.',
  'access.readOnly':
    'Vous pouvez consulter ces permissions, mais les modifier demande la capacité « Gérer les permissions des membres ».',
  'access.member': 'Membre',
  'access.role': 'Rôle',
  'access.effective': 'Capacités effectives',
  'access.direct': 'Attributions directes',

  'capabilities.sensitive': 'Sensible',
  'capabilities.destructive': 'Destructive',
  'capabilities.missingDependencies':
    'Inactive tant que ces capacités ne sont pas aussi accordées : {dependencies}',

  'public.register': 'S’inscrire',
  'public.details': 'Détails de l’événement',
  'public.organisedBy': 'Organisé par',

  'checkin.title': 'Enregistrement',
  'checkin.subtitle':
    'Les scans sont stockés sur cet appareil d’abord, puis synchronisés.',
  'checkin.queue': 'Scans en attente',
  'checkin.sync': 'Synchroniser',
  'checkin.addScan': 'Simuler un scan',
  'checkin.online': 'Connecté',
  'checkin.offline': 'Hors ligne — les scans sont mis en attente',
  'checkin.empty': 'Aucun scan en attente.',

  'platform.title': 'Administration de la plateforme',
  'platform.subtitle': 'Vue Future Studio sur toutes les organisations.',
  'platform.organization': 'Organisation',
  'platform.entitlement':
    '{organization} dispose de {granted} capacités sur {total}. Décocher une capacité la révoque immédiatement pour tous les membres.',
  'platform.enabled': 'Activée',
  'platform.forbidden': 'Réservé aux administrateurs de la plateforme',
  'platform.forbiddenBody':
    'Cet espace gère les droits des organisations à l’échelle de la plateforme et n’est pas accessible aux rôles d’un espace de travail.',

  'participant.title': 'Votre espace événement',
  'participant.subtitle': 'Badge, profil, rendez-vous et demandes.',

  'notFound.title': 'Page introuvable',
  'notFound.body': 'La page que vous cherchez n’existe pas.',
};
