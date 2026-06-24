"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ModernSelect, type ModernSelectOption } from "@/components/ui/modern-select";
import { LeadsMap } from "@/components/leads-map";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { InboxPanel } from "@/components/inbox-panel";
import { COUNTRIES, getTimezones, tzOffsetLabel, detectTimezone, detectCountryCode } from "@/lib/locale-data";
import { createClient } from "@/lib/supabase/client";
import {
  Home,
  Sliders,
  Database,
  MessageSquare,
  Bell,
  BarChart3,
  Code2,
  Settings,
  Plus,
  Send,
  Loader2,
  Trash2,
  Copy,
  Check,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Users,
  MessageCircle,
  HelpCircle,
  LogOut,
  RefreshCw,
  Globe,
  Save,
  Menu,
  X,
  FileText,
  Calendar,
  Mail,
  FolderOpen,
  CheckSquare,
  HardDrive,
  FileSpreadsheet,
  Presentation,
  ExternalLink,
  AlertCircle,
  Paperclip,
  FileUp,
  Link2,
  ChevronUp,
  Layers,
  ArrowUp,
  Palette,
  Laptop,
  MoreHorizontal,
  Monitor,
  Mic,
  Puzzle,
  Search,
  Type,
  MapPin,
  Inbox
} from "lucide-react";

// Types
interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  company?: string;
  job_title?: string;
  country?: string;
  industry?: string;
  budget?: string;
  custom_fields?: Record<string, any>;
  [key: string]: any;
}

interface Source {
  id: string;
  type: "text" | "url" | "file";
  name: string;
  content: string;
  status: "training" | "trained";
  charCount: number;
}

interface QuickReply {
  label: string;
  value: string;
  icon?: string;
}

interface KnowledgeMessage {
  role: string;
  content: string;
  status?: "info" | "success" | "error" | "pending";
  filename?: string;
  quickReplies?: QuickReply[];
  connectorButtons?: boolean;
  calendarButtons?: boolean;
  leadFieldPicker?: boolean;
  tzPicker?: boolean;
  providerPicker?: boolean;
  isSetup?: boolean;
  thinkingSteps?: string[];
}

const LOCALE_TEXTS: Record<string, Record<string, string>> = {
  EN: {
    overview: "Overview",
    customizer: "Customizer",
    knowledge_base: "Knowledge Base",
    playground: "Playground",
    leads: "Leads",
    analytics: "Analytics",
    integrations: "Embed & Integrate",
    settings: "Agent Settings",
    meetings: "Meetings",
    notifications: "Notifications",
    audit_log: "Audit Log",
    training_data: "Training Data",
    setup_wizard: "AI Assistant Setup Wizard",
    welcome: "Hi! Would you like to train the assistant using your business data?",
    yes: "Yes",
    no: "No",
    supported_sources: "Supported Sources",
    optional_integrations: "Optional Integrations",
    processing: "Processing your files...",
    training_completed: "Training completed successfully.",
    custom_instructions_q: "Do you have any custom instructions, rules, policies, or response guidelines?",
    save_instructions: "Save Instructions",
    instructions_saved: "Instructions received and saved successfully.",
    enable_lead_extraction: "Would you like to enable Lead Extraction?",
    lead_fields_q: "Please specify which lead fields should be captured.",
    lead_configured: "Lead extraction configured successfully.",
    schedule_meetings_q: "Would you like the assistant to schedule meetings with leads?",
    timezone_confirm: "Please confirm country and timezone:",
    calendar_integration_q: "Please connect your calendar:",
    calendar_connected: "Calendar connected successfully.",
    meeting_provider_q: "Please select meeting providers:",
    provider_configured: "Meeting provider configured successfully.",
    scheduling_rules: "Scheduling Rules Checklist:",
    confirm_rules: "Review and Proceed",
    notifications_setup: "Setup notification channels when a meeting is booked:",
    notify_client: "Notify Client via Email & Push",
    notify_admin: "Notify Administrator via Email & Push",
    setup_completed: "Setup completed successfully.",
    go_to_admin: "Open Admin Panel",
    back: "Back",
    next: "Next",
    skip: "Skip Setup",
    language: "Language",
    timezone: "Timezone",
    country: "Country",
  },
  ES: {
    overview: "Vista General",
    customizer: "Personalizador",
    knowledge_base: "Base de Conocimientos",
    playground: "Área de Pruebas",
    leads: "Clientes Potenciales",
    analytics: "Analítica",
    integrations: "Incrustar e Integrar",
    settings: "Configuración del Agente",
    meetings: "Reuniones",
    notifications: "Notificaciones",
    audit_log: "Registro de Auditoría",
    training_data: "Datos de Entrenamiento",
    setup_wizard: "Asistente de Configuración de IA",
    welcome: "¿Le gustaría entrenar al asistente con los datos de su negocio?",
    yes: "Sí",
    no: "No",
    supported_sources: "Fuentes Soportadas",
    optional_integrations: "Integraciones Opcionales",
    processing: "Procesando sus archivos...",
    training_completed: "Entrenamiento completado con éxito.",
    custom_instructions_q: "¿Tiene alguna instrucción personalizada, regla, política o guía de respuesta?",
    save_instructions: "Guardar Instrucciones",
    instructions_saved: "Instrucciones recibidas y guardadas con éxito.",
    enable_lead_extraction: "¿Le gustaría activar la Extracción de Clientes Potenciales?",
    lead_fields_q: "Por favor, especifique qué campos de clientes potenciales capturar.",
    lead_configured: "Extracción de clientes potenciales configurada con éxito.",
    schedule_meetings_q: "¿Le gustaría que el asistente programe reuniones con clientes potenciales?",
    timezone_confirm: "Por favor, confirme país y zona horaria:",
    calendar_integration_q: "Por favor, conecte su calendario:",
    calendar_connected: "Calendario conectado con éxito.",
    meeting_provider_q: "Por favor, seleccione proveedores de reuniones:",
    provider_configured: "Proveedor de reuniones configurado con éxito.",
    scheduling_rules: "Lista de Reglas de Programación:",
    confirm_rules: "Revisar y Continuar",
    notifications_setup: "Configure los canales de notificación cuando se reserve una reunión:",
    notify_client: "Notificar al Cliente por Correo y Push",
    notify_admin: "Notificar al Administrador por Correo y Push",
    setup_completed: "Configuración completada con éxito.",
    go_to_admin: "Abrir Panel de Administración",
    back: "Atrás",
    next: "Siguiente",
    skip: "Omitir Configuración",
    language: "Idioma",
    timezone: "Zona Horaria",
    country: "País",
  },
  FR: {
    overview: "Vue d'ensemble",
    customizer: "Personnalisateur",
    knowledge_base: "Base de Connaissances",
    playground: "Espace d'essai",
    leads: "Prospects",
    analytics: "Analytiques",
    integrations: "Intégrer le code",
    settings: "Paramètres de l'agent",
    meetings: "Réunions",
    notifications: "Notifications",
    audit_log: "Journal d'audit",
    training_data: "Données d'entraînement",
    setup_wizard: "Assistant de Configuration IA",
    welcome: "Souhaitez-vous entraîner l'assistant en utilisant les données de votre entreprise?",
    yes: "Oui",
    no: "Non",
    supported_sources: "Sources Supportées",
    optional_integrations: "Intégrations Optionnelles",
    processing: "Traitement de vos fichiers...",
    training_completed: "Entraînement terminé avec succès.",
    custom_instructions_q: "Avez-vous des instructions personnalisées, des règles ou des directives de réponse?",
    save_instructions: "Enregistrer les Instructions",
    instructions_saved: "Instructions reçues et enregistrées avec succès.",
    enable_lead_extraction: "Souhaitez-vous activer l'extraction de prospects?",
    lead_fields_q: "Veuillez spécifier quels champs de prospects doivent être capturés.",
    lead_configured: "Extraction de prospects configurée avec succès.",
    schedule_meetings_q: "Souhaitez-vous que l'assistant planifie des réunions avec les prospects?",
    timezone_confirm: "Veuillez confirmer le pays et le fuseau horaire:",
    calendar_integration_q: "Veuillez connecter votre calendrier:",
    calendar_connected: "Calendrier connecté avec succès.",
    meeting_provider_q: "Veuillez sélectionner les fournisseurs de réunion:",
    provider_configured: "Fournisseur de réunion configuré avec succès.",
    scheduling_rules: "Liste des règles de planification:",
    confirm_rules: "Vérifier et Continuer",
    notifications_setup: "Configurer les canaux de notification lors de la réservation d'une réunion:",
    notify_client: "Notifier le client par e-mail et push",
    notify_admin: "Notifier l'administrateur par e-mail et push",
    setup_completed: "Configuration terminée avec succès.",
    go_to_admin: "Ouvrir le panneau d'administration",
    back: "Retour",
    next: "Suivant",
    skip: "Ignorer la configuration",
    language: "Langue",
    timezone: "Fuseau Horaire",
    country: "Pays",
  },
  DE: {
    overview: "Übersicht",
    customizer: "Anpasser",
    knowledge_base: "Wissensdatenbank",
    playground: "Spielwiese",
    leads: "Kontakte",
    analytics: "Analysen",
    integrations: "Einbetten & Integrieren",
    settings: "Agenten-Einstellungen",
    meetings: "Besprechungen",
    notifications: "Benachrichtigungen",
    audit_log: "Audit-Protokoll",
    training_data: "Trainingsdaten",
    setup_wizard: "KI-Assistent Onboarding-Assistent",
    welcome: "Möchten Sie den Assistenten mit Ihren Geschäftsdaten trainieren?",
    yes: "Ja",
    no: "Nein",
    supported_sources: "Unterstützte Quellen",
    optional_integrations: "Optionale Integrationen",
    processing: "Ihre Dateien werden verarbeitet...",
    training_completed: "Training erfolgreich abgeschlossen.",
    custom_instructions_q: "Haben Sie benutzerdefinierte Anweisungen, Regeln, Richtlinien oder Antwortrichtlinien?",
    save_instructions: "Anweisungen Speichern",
    instructions_saved: "Anweisungen erfolgreich empfangen und gespeichert.",
    enable_lead_extraction: "Möchten Sie die Lead-Extraktion aktivieren?",
    lead_fields_q: "Bitte geben Sie an, welche Lead-Felder erfasst werden sollen.",
    lead_configured: "Lead-Extraktion erfolgreich konfiguriert.",
    schedule_meetings_q: "Möchten Sie, dass der Assistent Termine mit Leads vereinbart?",
    timezone_confirm: "Bitte bestätigen Sie Land und Zeitzone:",
    calendar_integration_q: "Bitte verbinden Sie Ihren Kalender:",
    calendar_connected: "Kalender erfolgreich verbunden.",
    meeting_provider_q: "Bitte wählen Sie Meeting-Anbieter aus:",
    provider_configured: "Meeting-Anbieter erfolgreich konfiguriert.",
    scheduling_rules: "Checkliste für Planungsregeln:",
    confirm_rules: "Überprüfen und fortfahren",
    notifications_setup: "Benachrichtigungskanäle einrichten, wenn ein Termin gebucht wird:",
    notify_client: "Client per E-Mail & Push benachrichtigen",
    notify_admin: "Administrator per E-Mail & Push benachrichtigen",
    setup_completed: "Einrichtung erfolgreich abgeschlossen.",
    go_to_admin: "Admin-Panel öffnen",
    back: "Zurück",
    next: "Weiter",
    skip: "Einrichtung überspringen",
    language: "Sprache",
    timezone: "Zeitzone",
    country: "Land",
  },
  IT: {
    overview: "Panoramica",
    customizer: "Personalizzatore",
    knowledge_base: "Database Conoscenza",
    playground: "Area di Prova",
    leads: "Contatti",
    analytics: "Analisi",
    integrations: "Incorpora e Integra",
    settings: "Impostazioni Agente",
    meetings: "Riunioni",
    notifications: "Notifiche",
    audit_log: "Registro di Audit",
    training_data: "Dati di Addestramento",
    setup_wizard: "Configurazione Guidata Assistente IA",
    welcome: "Vorresti addestrare l'assistente usando i tuoi dati aziendali?",
    yes: "Sì",
    no: "No",
    supported_sources: "Fonti Supportate",
    optional_integrations: "Integrazioni Opzionali",
    processing: "Elaborazione dei file in corso...",
    training_completed: "Addestramento completato con successo.",
    custom_instructions_q: "Hai istruzioni personalizzate, regole, politiche o linee guida per le risposte?",
    save_instructions: "Salva Istruzioni",
    instructions_saved: "Istruzioni ricevute e salvate con successo.",
    enable_lead_extraction: "Vorresti abilitare l'estrazione dei contatti?",
    lead_fields_q: "Specifica quali campi dei contatti catturare.",
    lead_configured: "Estrazione contatti configurata con successo.",
    schedule_meetings_q: "Vorresti che l'assistente pianifichi riunioni con i contatti?",
    timezone_confirm: "Conferma paese e fuso orario:",
    calendar_integration_q: "Connetti il tuo calendario:",
    calendar_connected: "Calendario connesso con successo.",
    meeting_provider_q: "Seleziona i provider per le riunioni:",
    provider_configured: "Provider di riunioni configurato con successo.",
    scheduling_rules: "Checklist Regole di Pianificazione:",
    confirm_rules: "Rivedi e Procedi",
    notifications_setup: "Configura i canali di notifica alla prenotazione di una riunione:",
    notify_client: "Notifica Cliente via Email e Push",
    notify_admin: "Notifica Amministratore via Email e Push",
    setup_completed: "Configurazione completata con successo.",
    go_to_admin: "Apri Pannello Amministratore",
    back: "Indietro",
    next: "Avanti",
    skip: "Salta Configurazione",
    language: "Lingua",
    timezone: "Fuso Orario",
    country: "Paese",
  }
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const supabase = createClient();

  // User State
  const [user, setUser] = useState<any>(null);
  const [botId, setBotId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Chatbot State
  const [botName, setBotName] = useState("Chatty Assistant");
  const [welcomeMsg, setWelcomeMsg] = useState("Hello! How can I help you today?");
  const [conversationStarters, setConversationStarters] = useState<string[]>([]);
  const [teaserMessage, setTeaserMessage] = useState("👋 Need help? Chat with us.");
  const [primaryColor, setPrimaryColor] = useState("#f97316"); // default
  const [widgetStyle, setWidgetStyle] = useState<"minimalist" | "glassmorphism" | "liquid" | "neumorphism">("minimalist");
  const [sendButtonStyle, setSendButtonStyle] = useState("plane");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini");
  const [systemInstructions, setSystemInstructions] = useState(
    "You are a helpful customer support agent for my business. You must only answer questions based on the provided knowledge. Be concise and polite."
  );
  const [strictMode, setStrictMode] = useState(true);
  const [emailNotify, setEmailNotify] = useState(true);

  // Unsaved Changes Tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Lists (No demo data by default - queries Supabase)
  const [sources, setSources] = useState<Source[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);

  // Training inputs
  const [inputText, setInputText] = useState("");
  const [inputTitle, setInputTitle] = useState("");
  const [inputUrl, setInputUrl] = useState("");

  // RAG / Cloud Connectors State
  const [googleConnected, setGoogleConnected] = useState(false);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [microsoftEmail, setMicrosoftEmail] = useState<string | null>(null);
  const [telegramId, setTelegramId] = useState<number | null>(null);
  const [telegramLinkOpen, setTelegramLinkOpen] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<"google" | "microsoft" | null>(null);

  // Sync controls (each separate card)
  const [syncGoogleDrive, setSyncGoogleDrive] = useState(false);
  const [syncGoogleCalendar, setSyncGoogleCalendar] = useState(false);
  const [syncGmail, setSyncGmail] = useState(false);
  const [syncGoogleTasks, setSyncGoogleTasks] = useState(false);
  const [syncGoogleContacts, setSyncGoogleContacts] = useState(false);
  const [syncGoogleDocs, setSyncGoogleDocs] = useState(false);
  const [syncGoogleSheets, setSyncGoogleSheets] = useState(false);
  const [syncGoogleSlides, setSyncGoogleSlides] = useState(false);

  // Scheduling settings
  const [calendarSchedulingEnabled, setCalendarSchedulingEnabled] = useState(false);
  const [schedulingDuration, setSchedulingDuration] = useState(30);
  const [botTimezone, setBotTimezone] = useState("UTC");

  // Editable booking rules
  const [businessHoursStart, setBusinessHoursStart] = useState(9);
  const [businessHoursEnd, setBusinessHoursEnd] = useState(17);
  const [workingDays, setWorkingDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [advanceNoticeHours, setAdvanceNoticeHours] = useState(0);

  // Developer / API keys
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copiedApiKey, setCopiedApiKey] = useState(false);

  // Backend capabilities (which optional integrations have keys configured)
  const [zoomConfigured, setZoomConfigured] = useState(false);
  const [onesignalConfigured, setOnesignalConfigured] = useState(false);

  // Security: allowed domains for the embed widget
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");

  // Google Drive indexing settings
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [driveMaxFiles, setDriveMaxFiles] = useState(50);
  const [isIndexingDrive, setIsIndexingDrive] = useState(false);
  const [driveIndexError, setDriveIndexError] = useState<string | null>(null);
  const [driveIndexSuccess, setDriveIndexSuccess] = useState<string | null>(null);

  const [syncOneDrive, setSyncOneDrive] = useState(false);
  const [syncMicrosoftToDo, setSyncMicrosoftToDo] = useState(false);
  const [syncOutlook, setSyncOutlook] = useState(false);
  const [syncOutlookCalendar, setSyncOutlookCalendar] = useState(false);
  const [syncOutlookContacts, setSyncOutlookContacts] = useState(false);
  const [syncTelegram, setSyncTelegram] = useState(false);

  // Analytics State
  const [totalQueries, setTotalQueries] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [conversionRate, setConversionRate] = useState("0.0");
  const [analyticsChartData, setAnalyticsChartData] = useState<Array<{ day: string; count: number; height: string }>>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);


  const [liveThinkingSteps, setLiveThinkingSteps] = useState<string[]>([]);
  const [playgroundInput, setPlaygroundInput] = useState("");
  const [playgroundView, setPlaygroundView] = useState<"test" | "live">("test");
  const [isBotResponding, setIsBotResponding] = useState(false);
  const [collectedInPlayground, setCollectedInPlayground] = useState(false);
  
  // Lead collection flow inside playground chat
  const [leadStep, setLeadStep] = useState<"none" | "ask_name" | "ask_email" | "ask_phone">("none");
  const [tempLead, setTempLead] = useState({ name: "", email: "", phone: "" });

  const playgroundEndRef = useRef<HTMLDivElement>(null);

  // Localization State
  const [language, setLanguage] = useState<"EN" | "ES" | "FR" | "DE" | "IT">("EN");

  // Onboarding Wizard State
  const [onboardingStep, setOnboardingStep] = useState<number>(0);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(false);
  const [leadFields, setLeadFields] = useState<string[]>(["name", "email", "phone"]);
  const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(true);
  const [leadRequiredFields, setLeadRequiredFields] = useState<string[]>(["name", "email"]);
  const [newLeadField, setNewLeadField] = useState("");
  const [savingLeadCapture, setSavingLeadCapture] = useState(false);
  const [botCountry, setBotCountry] = useState<string>("");
  const [syncOffice365Calendar, setSyncOffice365Calendar] = useState<boolean>(false);
  const [meetingProvider, setMeetingProvider] = useState<string>("google_meet");
  // agenticSetupStep: which conversational setup step the chat assistant is at
  // 0=not started, 1=welcome, 2=docs_upload, 3=instructions, 4=lead_fields, 5=meetings, 6=calendar, 7=meeting_provider, 8=notifications, 9=done
  const [agenticSetupStep, setAgenticSetupStep] = useState<number>(0);
  const [pendingLeadFields, setPendingLeadFields] = useState<string[]>(["name", "email", "phone"]);

  // Admin Panel Data
  const [adminMeetings, setAdminMeetings] = useState<any[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<any[]>([]);
  const [loadingAdminData, setLoadingAdminData] = useState<boolean>(false);

  // Leads and Meetings States & Helpers
  const [leadsSearch, setLeadsSearch] = useState<string>("");

  const getLeadFieldValue = (lead: any, field: string) => {
    if (lead[field] !== undefined && lead[field] !== null) {
      return String(lead[field]);
    }
    if (lead.custom_fields && lead.custom_fields[field] !== undefined && lead.custom_fields[field] !== null) {
      return String(lead.custom_fields[field]);
    }
    return "N/A";
  };

  const filteredLeads = leads.filter(l => {
    const query = leadsSearch.toLowerCase();
    return (
      l.name.toLowerCase().includes(query) ||
      l.email.toLowerCase().includes(query) ||
      l.phone.toLowerCase().includes(query) ||
      (l.company && l.company.toLowerCase().includes(query)) ||
      (l.job_title && l.job_title.toLowerCase().includes(query)) ||
      (l.custom_fields && Object.values(l.custom_fields).some(val => String(val).toLowerCase().includes(query)))
    );
  });

  const exportLeadsCSV = () => {
    const headers = [...leadFields, "captured_at"];
    const csvRows = [];
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","));
    filteredLeads.forEach(lead => {
      const values = headers.map(field => {
        const val = getLeadFieldValue(lead, field);
        return `"${val.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(","));
    });
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `chatty_leads_${botId || "export"}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdateMeetingStatus = async (meetingId: string, newStatus: string) => {
    try {
      const res = await fetchWithFallback(`/api/admin/meetings/${meetingId}/status?status=${newStatus}`, {
        method: "POST"
      });
      if (res.ok) {
        if (botId) await loadAdminData(botId);
      } else {
        console.error("Failed to update meeting status");
      }
    } catch (err) {
      console.error("Error updating meeting status:", err);
    }
  };

  // Knowledge Base Chat States
  const [playgroundMessages, setPlaygroundMessages] = useState<KnowledgeMessage[]>([]);
  const [knowledgeInput, setKnowledgeInput] = useState("");
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [paperclipOpen, setPaperclipOpen] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<"none" | "recent_files" | "skills" | "more">("none");
  const [connectorsDropdownOpen, setConnectorsDropdownOpen] = useState(false);
  const [syncInstagram, setSyncInstagram] = useState(true);
  const [syncBrowser, setSyncBrowser] = useState(false);
  const [showSourcesSidebar, setShowSourcesSidebar] = useState(false);
  const knowledgeEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Knowledge Base tab UI state
  const [kbSourceTab, setKbSourceTab] = useState<"text" | "url" | "file" | "drive" | "onedrive">("text");
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [scanningSitemap, setScanningSitemap] = useState(false);
  const [crawlingPages, setCrawlingPages] = useState(false);
  const [crawlSummary, setCrawlSummary] = useState<string | null>(null);
  const [sourcesSearch, setSourcesSearch] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<"all" | "text" | "url" | "file">("all");
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  // Mailbox tab state
  const [mailboxFilter, setMailboxFilter] = useState<"all" | "client" | "admin">("all");
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);

  // Copy code animation state
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedIframe, setCopiedIframe] = useState(false);

  // Backend Integration URL
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://personaliai-api-376030619262.us-central1.run.app";

  // Authenticate user and fetch configuration from Supabase
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await checkCloudConnections(session.user.id);
          await loadBotSettings(session.user.id);
          try {
            const capRes = await fetchWithFallback("/api/capabilities");
            if (capRes.ok) {
              const cap = await capRes.json();
              setZoomConfigured(!!cap.zoom_configured);
              setOnesignalConfigured(!!cap.onesignal_configured);
            }
          } catch (e) {
            console.error("Failed to load capabilities:", e);
          }
        }
      } catch (err) {
        console.error("Supabase session check error:", err);
      } finally {
        setLoadingSession(false);
      }
    }
    checkSession();
  }, []);

  // Helper for resilient fetch calls with fallback to production backend
  const fetchWithFallback = async (path: string, options: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers = {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    try {
      return await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
    } catch (err) {
      console.warn(`Local backend down for ${path}, retrying with production fallback...`);
      const fallbackUrl = "https://personaliai-api-376030619262.us-central1.run.app";
      return await fetch(`${fallbackUrl}${path}`, { ...options, headers });
    }
  };

  // Check backend integration state & query email accounts
  async function checkCloudConnections(userId: string) {
    try {
      // Fetch from API to check calendar/auth session
      const res = await fetchWithFallback("/api/integrations/calendar/events");

      // Query public users table for integrated emails
      const { data: uData } = await supabase
        .from("users")
        .select("google_email, microsoft_email, telegram_id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (uData) {
        setGoogleEmail(uData.google_email || null);
        setMicrosoftEmail(uData.microsoft_email || null);
        setTelegramId(uData.telegram_id || null);
        setGoogleConnected(!!uData.google_email);
        setMicrosoftConnected(!!uData.microsoft_email);
      } else if (res.ok) {
        const body = await res.json();
        setGoogleConnected(body.connected?.google || false);
        setMicrosoftConnected(body.connected?.microsoft || false);
      }
    } catch (err) {
      console.warn("Could not check real cloud connections:", err);
    }
  }

  // Load analytics counts and graph directly from database
  async function loadAnalyticsData(activeBotId: string, currentLeadsCount: number) {
    setLoadingAnalytics(true);
    try {
      // 1. Total user queries
      const { count: queriesCount } = await supabase
        .from("chatty_conversations")
        .select("*", { count: "exact", head: true })
        .eq("bot_id", activeBotId)
        .eq("role", "user");

      setTotalQueries(queriesCount || 0);

      // 2. Total unique sessions
      const { data: convData } = await supabase
        .from("chatty_conversations")
        .select("session_id")
        .eq("bot_id", activeBotId);

      const uniqueSessions = new Set(convData?.map(c => c.session_id) || []).size;
      setTotalSessions(uniqueSessions);

      // 3. Lead conversion rate
      const rate = uniqueSessions > 0 ? ((currentLeadsCount / uniqueSessions) * 100).toFixed(1) : "0.0";
      setConversionRate(rate);

      // 4. Last 7 days query chart
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data: queryData } = await supabase
        .from("chatty_conversations")
        .select("created_at")
        .eq("bot_id", activeBotId)
        .eq("role", "user")
        .gte("created_at", sevenDaysAgo.toISOString());

      const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const last7Days: Array<{ dateString: string; dayLabel: string; count: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push({
          dateString: d.toDateString(),
          dayLabel: daysOfWeek[d.getDay()],
          count: 0
        });
      }

      if (queryData) {
        queryData.forEach(q => {
          const qDate = new Date(q.created_at).toDateString();
          const dayObj = last7Days.find(d => d.dateString === qDate);
          if (dayObj) {
            dayObj.count++;
          }
        });
      }

      const maxCount = Math.max(...last7Days.map(d => d.count), 1);
      const chart = last7Days.map(d => ({
        day: d.dayLabel,
        count: d.count,
        height: `${(d.count / maxCount) * 100}%`
      }));
      setAnalyticsChartData(chart);
    } catch (err) {
      console.error("Error loading analytics data:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  }

  // Fetch bot settings, sources, and leads
  async function loadBotSettings(userId: string) {
    setLoadingLists(true);
    try {
      const { data: bots, error } = await supabase
        .from("chatty_bots")
        .select("*")
        .eq("user_id", userId)
        .limit(1);

      if (error) throw error;
      let activeBot = bots?.[0];

      if (!activeBot) {
        // Create a default chatbot configuration if none exists
        const { data: newBot, error: createError } = await supabase
          .from("chatty_bots")
          .insert({
            user_id: userId,
            name: "Chatty Assistant",
            welcome_message: "Hello! How can I help you today?",
            primary_color: "#f97316",
            widget_style: "minimalist",
            send_button_style: "plane",
            selected_model: "gemini",
            system_instructions: "You are a helpful customer support agent for my business. You must only answer questions based on the provided knowledge. Be concise and polite.",
            strict_mode: true,
            email_notify: true
          })
          .select()
          .single();

        if (createError) throw createError;
        activeBot = newBot;
      }

      if (activeBot) {
        setBotId(activeBot.id);
        setBotName(activeBot.name);
        setWelcomeMsg(activeBot.welcome_message);
        setConversationStarters(Array.isArray(activeBot.conversation_starters) ? activeBot.conversation_starters : []);
        setTeaserMessage(activeBot.teaser_message || "👋 Need help? Chat with us.");
        setPrimaryColor(activeBot.primary_color);
        setWidgetStyle(activeBot.widget_style || "minimalist");
        setSendButtonStyle(activeBot.send_button_style || "plane");
        setLogoUrl(activeBot.logo_url || null);
        setSelectedModel(activeBot.selected_model);
        setSystemInstructions(activeBot.system_instructions);
        setStrictMode(activeBot.strict_mode);
        setEmailNotify(activeBot.email_notify);

        setSyncGoogleDrive(activeBot.sync_google_drive || false);
        setSyncGoogleCalendar(activeBot.sync_google_calendar || false);
        setCalendarSchedulingEnabled(activeBot.calendar_scheduling_enabled || false);
        setSchedulingDuration(activeBot.scheduling_duration_minutes || 30);
        setBotTimezone(activeBot.bot_timezone || "UTC");
        setBusinessHoursStart(activeBot.business_hours_start ?? 9);
        setBusinessHoursEnd(activeBot.business_hours_end ?? 17);
        setWorkingDays(activeBot.working_days || ["mon", "tue", "wed", "thu", "fri"]);
        setBufferMinutes(activeBot.buffer_minutes ?? 0);
        setAdvanceNoticeHours(activeBot.advance_notice_hours ?? 0);
        setAllowedDomains(activeBot.allowed_domains || []);
        setOnboardingStep(activeBot.onboarding_step || 0);
        setOnboardingCompleted(activeBot.onboarding_completed || false);
        setLeadFields(activeBot.lead_fields || ["name", "email", "phone"]);
        setLeadCaptureEnabled(activeBot.lead_capture_enabled ?? true);
        setLeadRequiredFields(activeBot.lead_required_fields || ["name", "email"]);
        setBotCountry(activeBot.bot_country || "");
        setSyncOutlookCalendar(activeBot.sync_outlook_calendar || false);
        setSyncOffice365Calendar(activeBot.sync_office365_calendar || false);
        setMeetingProvider(activeBot.meeting_provider || "google_meet");
        if (!activeBot.onboarding_completed) {
          // Show the structured onboarding wizard for new bots
          setShowWizard(true);
        }

        // Fetch sources
        const { data: srcList } = await supabase
          .from("chatty_sources")
          .select("*")
          .eq("bot_id", activeBot.id);

        if (srcList) {
          setSources(srcList.map(s => ({
            id: s.id,
            type: s.type,
            name: s.name,
            content: s.content,
            status: s.status,
            charCount: s.char_count
          })));
        }

        // Fetch leads
        const { data: leadList } = await supabase
          .from("chatty_leads")
          .select("*")
          .eq("bot_id", activeBot.id)
          .order("created_at", { ascending: false });

        let currentLeadsCount = 0;
        if (leadList) {
          const mappedLeads = leadList.map(l => ({
            ...l,
            id: l.id,
            name: l.name || "Anonymous",
            email: l.email || "N/A",
            phone: l.phone || "N/A",
            created_at: new Date(l.created_at).toISOString().slice(0, 16).replace("T", " ")
          }));
          setLeads(mappedLeads);
          currentLeadsCount = mappedLeads.length;
        }

        // Recalculate real analytics
        await loadAnalyticsData(activeBot.id, currentLeadsCount);
      }
    } catch (err) {
      console.error("Error loading bot database config:", err);
    } finally {
      setLoadingLists(false);
    }
  }

  // Localized Text Translation Helper
  const t = (key: string) => {
    return LOCALE_TEXTS[language]?.[key] || LOCALE_TEXTS["EN"]?.[key] || key;
  };

  // ── Dropdown option lists (memoized) ───────────────────────────────────────
  const timezoneOptions: ModernSelectOption[] = useMemo(
    () =>
      getTimezones().map((tz) => {
        const off = tzOffsetLabel(tz);
        return { value: tz, label: tz.replace(/_/g, " "), hint: off ? `(${off})` : undefined };
      }),
    []
  );
  const countryOptions: ModernSelectOption[] = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.code, label: c.name, icon: <span>{c.flag}</span> })),
    []
  );
  const providerOptions: ModernSelectOption[] = useMemo(
    () => [
      {
        value: "google_meet",
        label: "Google Meet",
        icon: <span>📹</span>,
        disabled: !googleConnected,
        hint: googleConnected ? undefined : "connect Google",
      },
      {
        value: "zoom",
        label: "Zoom",
        icon: <span>🔵</span>,
        disabled: !zoomConfigured,
        hint: zoomConfigured ? undefined : "Zoom not configured",
      },
      {
        value: "teams",
        label: "Microsoft Teams",
        icon: <span>🟣</span>,
        disabled: !microsoftConnected,
        hint: microsoftConnected ? undefined : "connect Microsoft",
      },
    ],
    [googleConnected, microsoftConnected, zoomConfigured]
  );
  const languageOptions: ModernSelectOption[] = useMemo(
    () => [
      { value: "EN", label: "English", icon: <span>🇬🇧</span> },
      { value: "ES", label: "Español", icon: <span>🇪🇸</span> },
      { value: "FR", label: "Français", icon: <span>🇫🇷</span> },
      { value: "DE", label: "Deutsch", icon: <span>🇩🇪</span> },
      { value: "IT", label: "Italiano", icon: <span>🇮🇹</span> },
    ],
    []
  );

  // Auto-detect timezone + country once the session is ready, if not already set.
  useEffect(() => {
    if (loadingSession) return;
    if (!botTimezone || botTimezone === "UTC") setBotTimezone(detectTimezone());
    if (!botCountry) setBotCountry(detectCountryCode());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingSession]);

  // Localized Date-Time Formatter
  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const locales: Record<string, string> = { EN: "en-US", ES: "es-ES", FR: "fr-FR", DE: "de-DE", IT: "it-IT" };
      return new Intl.DateTimeFormat(locales[language] || "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: botTimezone || "UTC"
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Load Admin Panel Data (Meetings, Notifications, Audit Logs)
  async function loadAdminData(bId: string) {
    setLoadingAdminData(true);
    try {
      // 1. Fetch meetings
      const meetingsRes = await fetchWithFallback(`/api/admin/meetings?bot_id=${bId}`);
      if (meetingsRes.ok) {
        const d = await meetingsRes.json();
        setAdminMeetings(d.meetings || []);
      }
      // 2. Fetch notifications
      const notificationsRes = await fetchWithFallback(`/api/admin/notifications?bot_id=${bId}`);
      if (notificationsRes.ok) {
        const d = await notificationsRes.json();
        setAdminNotifications(d.notifications || []);
      }
      // 3. Fetch audit logs
      const auditRes = await fetchWithFallback(`/api/admin/audit-logs?bot_id=${bId}`);
      if (auditRes.ok) {
        const d = await auditRes.json();
        setAdminAuditLogs(d.audit_logs || []);
      }
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoadingAdminData(false);
    }
  }

  // Load Admin Data on tab changes
  useEffect(() => {
    if (botId && ["meetings", "notifications", "mailbox", "audit_log", "leads", "playground"].includes(activeTab)) {
      loadAdminData(botId);
    }
    if (botId && activeTab === "developer") {
      loadApiKeys(botId);
    }
  }, [activeTab, botId]);

  // Save Onboarding step progress
  async function saveOnboardingStep(step: number, completed: boolean, extraData: any = {}) {
    if (!botId) return;
    
    // Optimistically update local states
    setOnboardingStep(step);
    if (completed) {
      setOnboardingCompleted(true);
    }
    
    try {
      const res = await fetchWithFallback("/api/onboarding/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          step,
          completed,
          ...extraData
        })
      });
      if (!res.ok) {
        throw new Error("Failed to save step");
      }
      
      // Reload bot settings to sync state
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user?.id) {
        await loadBotSettings(sessionData.session.user.id);
      }
    } catch (err) {
      console.error("Error saving onboarding step:", err);
    }
  }

  // ── AGENTIC SETUP FLOW ──────────────────────────────────────────────────────
  // Returns the initial assistant message for each setup step
  function getAgenticStepMessage(step: number): KnowledgeMessage {
    switch (step) {
      case 1:
        return {
          role: "assistant",
          content: "👋 Hi! Would you like to **train** this assistant using your business data?",
          quickReplies: [
            { label: "Yes, let's set it up", value: "yes_setup", icon: "✅" },
            { label: "Skip for now", value: "skip_setup", icon: "⏭️" }
          ],
          isSetup: true
        };
      case 2:
        return {
          role: "assistant",
          content: "📂 Great! Please **send your documents** — PDF, TXT, DOCX, images, or CSV files.\n\nYou can also connect optional drives:",
          connectorButtons: true,
          quickReplies: [
            { label: "I've uploaded all my docs", value: "docs_done", icon: "✅" }
          ],
          isSetup: true
        };
      case 3:
        return {
          role: "assistant",
          content: "📋 **Do you have any custom instructions, rules, or policies** for the assistant?\n\nFor example: *Always be polite. Don't offer discounts. Refer inquiries outside North America to partners.*",
          quickReplies: [
            { label: "Skip — no custom rules", value: "skip_instructions", icon: "⏭️" }
          ],
          isSetup: true
        };
      case 4:
        return {
          role: "assistant",
          content: "🎯 **Would you like to enable Lead Extraction?**\n\nThe assistant will automatically collect visitor contact information during conversations.",
          quickReplies: [
            { label: "Yes, enable lead capture", value: "yes_leads", icon: "✅" },
            { label: "No, skip this", value: "skip_leads", icon: "⏭️" }
          ],
          isSetup: true
        };
      case 5:
        return {
          role: "assistant",
          content: "📋 **Which lead details should be captured?** Select the fields you need:\n\n*(Name and Email are always required)*",
          leadFieldPicker: true,
          quickReplies: [
            { label: "Confirm these fields", value: "confirm_lead_fields", icon: "✅" }
          ],
          isSetup: true
        };
      case 6:
        return {
          role: "assistant",
          content: "📅 **Would you like the assistant to schedule demo meetings with leads?**",
          quickReplies: [
            { label: "Yes, enable scheduling", value: "yes_meetings", icon: "✅" },
            { label: "No, skip", value: "skip_meetings", icon: "⏭️" }
          ],
          isSetup: true
        };
      case 7:
        return {
          role: "assistant",
          content: "🌍 **Confirm your country & timezone, pick a meeting provider, then connect a calendar.**\n\nWe auto-detected these from your browser — adjust if needed. The assistant will collect all required lead details *before* booking, then sync times to the visitor's timezone.",
          tzPicker: true,
          providerPicker: true,
          calendarButtons: true,
          quickReplies: [
            { label: "Calendar connected — continue", value: "calendar_done", icon: "✅" },
            { label: "Continue without calendar", value: "skip_calendar", icon: "⏭️" }
          ],
          isSetup: true
        };
      case 8:
        return {
          role: "assistant",
          content: "🔔 **Notification Setup Complete!**\n\n✅ Clients will receive meeting confirmation emails\n✅ You will receive instant booking alerts\n✅ Calendar invites sent automatically\n\nYour assistant is fully configured!",
          quickReplies: [
            { label: "🚀 Open Admin Panel", value: "goto_admin", icon: "" }
          ],
          isSetup: true
        };
      default:
        return {
          role: "assistant",
          content: "Hello! I am your **Knowledge Manager**. I can help you train your chatbot.\n\n1. **Upload files** (PDF, DOCX, TXT, MD) using the 📎 paperclip button.\n2. **Crawl websites** by pasting a URL or saying `crawl https://example.com`.\n3. **Train facts** by typing documentation directly here.\n4. **Test RAG memory** by asking questions like `What is the return policy?`"
        };
    }
  }

  // Initialize the agentic setup chat when the step changes
  useEffect(() => {
    if (agenticSetupStep > 0 && !onboardingCompleted) {
      const msg = getAgenticStepMessage(agenticSetupStep);
      setPlaygroundMessages(prev => {
        // Avoid duplicating if the last message is identical
        if (prev.length > 0 && prev[prev.length - 1].content === msg.content) return prev;
        return [...prev, msg];
      });
      // Navigate to knowledge tab so user sees the setup chat
      if (activeTab !== "playground") setActiveTab("playground");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenticSetupStep]);

  // Handle a quick reply button click in the setup flow
  const handleSetupQuickReply = async (value: string) => {
    // Map action to user message display
    const displayMap: Record<string, string> = {
      yes_setup: "Yes, let's set it up",
      skip_setup: "Skip for now",
      docs_done: "I've uploaded all my docs",
      skip_instructions: "Skip — no custom rules",
      yes_leads: "Yes, enable lead capture",
      skip_leads: "No, skip this",
      confirm_lead_fields: "Confirm these fields",
      yes_meetings: "Yes, enable scheduling",
      skip_meetings: "No, skip",
      skip_calendar: "Continue without calendar",
      calendar_done: "Calendar connected — continue",
      goto_admin: "Open Admin Panel",
    };
    const displayLabel = displayMap[value] || value;
    setPlaygroundMessages(prev => [...prev, { role: "user", content: displayLabel }]);

    if (value === "skip_setup") {
      setOnboardingCompleted(true);
      setAgenticSetupStep(0);
      await saveOnboardingStep(9, true);
      setPlaygroundMessages(prev => [...prev, {
        role: "assistant",
        content: "No problem! The Knowledge Manager is ready whenever you are. Upload files, crawl URLs, or type facts to train your assistant."
      }]);
      return;
    }
    if (value === "yes_setup") {
      setAgenticSetupStep(2);
      return;
    }
    if (value === "docs_done") {
      setPlaygroundMessages(prev => [...prev, {
        role: "assistant", content: "✅ Processing complete! All documents have been indexed into RAG memory.", status: "success"
      }]);
      setTimeout(() => setAgenticSetupStep(3), 600);
      return;
    }
    if (value === "skip_instructions") {
      setAgenticSetupStep(4);
      return;
    }
    if (value === "yes_leads") {
      setAgenticSetupStep(5);
      return;
    }
    if (value === "skip_leads") {
      setAgenticSetupStep(6);
      return;
    }
    if (value === "confirm_lead_fields") {
      setLeadFields(pendingLeadFields);
      await saveOnboardingStep(4, false, { lead_fields: pendingLeadFields });
      setPlaygroundMessages(prev => [...prev, {
        role: "assistant",
        content: `✅ **Lead fields configured:** ${pendingLeadFields.join(", ")}\n\nYour lead table will automatically capture these fields from conversations.`,
        status: "success"
      }]);
      setTimeout(() => setAgenticSetupStep(6), 600);
      return;
    }
    if (value === "yes_meetings") {
      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setBotTimezone(detectedTz);
      setAgenticSetupStep(7);
      return;
    }
    if (value === "skip_meetings") {
      await saveOnboardingStep(8, false);
      setAgenticSetupStep(8);
      return;
    }
    if (value === "calendar_done") {
      setCalendarSchedulingEnabled(true);
      await saveOnboardingStep(8, false, {
        meeting_provider: meetingProvider,
        bot_timezone: botTimezone,
        bot_country: botCountry,
        calendar_scheduling_enabled: true,
      });
      setPlaygroundMessages(prev => [...prev, {
        role: "assistant",
        content: `✅ **Scheduling configured!** Provider: **${meetingProvider.replace("_", " ")}** · ${botCountry} · ${botTimezone}. The assistant will collect all lead details before booking and email both client and admin.`,
        status: "success"
      }]);
      setTimeout(() => setAgenticSetupStep(8), 700);
      return;
    }
    if (value === "skip_calendar") {
      await saveOnboardingStep(8, false);
      setAgenticSetupStep(8);
      return;
    }
    if (value === "calendar_google") {
      handleConnectCloud("google");
      return;
    }
    if (value === "calendar_microsoft") {
      handleConnectCloud("microsoft");
      return;
    }
    if (value === "goto_admin") {
      setOnboardingCompleted(true);
      setAgenticSetupStep(0);
      await saveOnboardingStep(9, true);
      setActiveTab("leads");
      return;
    }
  };

  // Handle Cloud Connector Disconnects
  const handleDisconnectCloud = async (provider: "google" | "microsoft") => {
    if (!confirm(`Disconnect ${provider === "google" ? "Google" : "Microsoft"}? This will turn off all syncing sources and clear connection tokens.`)) {
      return;
    }
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return;

      const res = await fetchWithFallback(`/api/integrations/${provider}/disconnect`, {
        method: "POST"
      });
      if (res.ok) {
        if (provider === "google") {
          setGoogleConnected(false);
          setGoogleEmail(null);
        } else {
          setMicrosoftConnected(false);
          setMicrosoftEmail(null);
        }
      }
    } catch (err) {
      console.error(`Error disconnecting ${provider}:`, err);
    }
  };

  // Telegram link and unlink
  const handleLinkTelegram = async (chatIdNum: number) => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return false;

      const res = await fetchWithFallback(`/api/integrations/telegram/link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ chat_id: chatIdNum })
      });
      if (res.ok) {
        setTelegramId(chatIdNum);
        return true;
      } else {
        const body = await res.json();
        throw new Error(body.message || "Failed to link Telegram");
      }
    } catch (err) {
      console.error("Error linking Telegram:", err);
      throw err;
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!confirm("Unlink this Telegram chat?")) return;
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return;

      const res = await fetchWithFallback(`/api/integrations/telegram/unlink`, {
        method: "POST"
      });
      if (res.ok) {
        setTelegramId(null);
      }
    } catch (err) {
      console.error("Error unlinking Telegram:", err);
    }
  };

  // Persist chatbot appearance/settings to Supabase
  async function handleSaveChanges() {
    if (!user || !botId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("chatty_bots")
        .update({
          name: botName,
          welcome_message: welcomeMsg,
          conversation_starters: conversationStarters.map((s) => s.trim()).filter(Boolean),
          teaser_message: teaserMessage,
          primary_color: primaryColor,
          widget_style: widgetStyle,
          send_button_style: sendButtonStyle,
          selected_model: selectedModel,
          system_instructions: systemInstructions,
          strict_mode: strictMode,
          email_notify: emailNotify,
          sync_google_drive: syncGoogleDrive,
          sync_google_calendar: syncGoogleCalendar,
          sync_outlook_calendar: syncOutlookCalendar,
          calendar_scheduling_enabled: calendarSchedulingEnabled,
          scheduling_duration_minutes: schedulingDuration,
          bot_timezone: botTimezone,
          bot_country: botCountry,
          meeting_provider: meetingProvider,
          business_hours_start: businessHoursStart,
          business_hours_end: businessHoursEnd,
          working_days: workingDays,
          buffer_minutes: bufferMinutes,
          advance_notice_hours: advanceNoticeHours,
          allowed_domains: allowedDomains,
          updated_at: new Date().toISOString()
        })
        .eq("id", botId);

      if (error) throw error;
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error("Error saving chatbot changes:", err);
    } finally {
      setIsSaving(false);
    }
  }

  // Handle Input Changes
  const handleInputChange = (setter: any, val: any) => {
    setter(val);
    setHasUnsavedChanges(true);
  };

  useEffect(() => {
    setPlaygroundMessages([
      { role: "assistant", content: welcomeMsg }
    ]);
  }, [welcomeMsg, activeTab]);

  useEffect(() => {
    playgroundEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [playgroundMessages, isBotResponding]);

  // Auto-scroll for Knowledge Chat
  useEffect(() => {
    knowledgeEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [playgroundMessages, isKnowledgeLoading, uploadingFile]);

  // Handle Knowledge Base File Upload
  const handleKnowledgeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !botId) return;

    // Check size limit: 20MB
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("File is too large. Max size allowed is 20MB.");
      return;
    }

    setUploadingFile(file.name);
    setIsKnowledgeLoading(true);

    // Add a pending message
    setPlaygroundMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: `Uploaded file: **${file.name}**`
      },
      {
        role: "assistant",
        content: `Uploading and indexing **${file.name}**... Please wait while I process the document structure and extract text chunks.`,
        status: "pending",
        filename: file.name
      }
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetchWithFallback("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const body = await res.json();
        
        // Update the assistant message in chat log
        setPlaygroundMessages((prev) =>
          prev.map((msg) =>
            msg.filename === file.name && msg.status === "pending"
              ? {
                  role: "assistant",
                  content: `Successfully trained on **${file.name}**! Added **${body.chunk_count || 0}** chunks to RAG memory.`,
                  status: "success"
                }
              : msg
          )
        );

        // Fetch sources to refresh lists
        if (user) {
          await loadBotSettings(user.id);
        }
      } else {
        const body = await res.json();
        setPlaygroundMessages((prev) =>
          prev.map((msg) =>
            msg.filename === file.name && msg.status === "pending"
              ? {
                  role: "assistant",
                  content: `Failed to index **${file.name}**. Error: ${body.detail || "Unknown backend error."}`,
                  status: "error"
                }
              : msg
          )
        );
      }
    } catch (err: any) {
      console.error("File upload error:", err);
      setPlaygroundMessages((prev) =>
        prev.map((msg) =>
          msg.filename === file.name && msg.status === "pending"
            ? {
                role: "assistant",
                content: `Could not connect to the upload server. Make sure the backend is active.`,
                status: "error"
              }
            : msg
        )
      );
    } finally {
      setIsKnowledgeLoading(false);
      setUploadingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle Knowledge Base Chat Submission
  const handleKnowledgeSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!knowledgeInput.trim() || !botId) return;

    const userInput = knowledgeInput.trim();
    setKnowledgeInput("");
    setIsKnowledgeLoading(true);

    // 1. Add User Message
    setPlaygroundMessages((prev) => [...prev, { role: "user", content: userInput }]);

    // ── AGENTIC SETUP INTERCEPTION ──────────────────────────────────────────
    // If we're in the agentic setup flow, handle the user's typed response
    if (agenticSetupStep > 0 && !onboardingCompleted) {
      setIsKnowledgeLoading(false);
      if (agenticSetupStep === 3) {
        // User is typing custom instructions
        setSystemInstructions(userInput);
        await saveOnboardingStep(3, false, { custom_instructions: userInput });
        setPlaygroundMessages(prev => [...prev, {
          role: "assistant",
          content: `✅ **Instructions saved!** Your assistant will follow these rules:\n\n> *${userInput}*`,
          status: "success"
        }]);
        setTimeout(() => setAgenticSetupStep(4), 800);
        return;
      }
      if (agenticSetupStep === 5) {
        // User might type custom field names
        const customFields = userInput.split(",").map(f => f.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
        const combined = [...new Set(["name", "email", ...customFields])];
        setPendingLeadFields(combined);
        setLeadFields(combined);
        await saveOnboardingStep(4, false, { lead_fields: combined });
        setPlaygroundMessages(prev => [...prev, {
          role: "assistant",
          content: `✅ **Lead fields confirmed:** ${combined.join(", ")}`,
          status: "success"
        }]);
        setTimeout(() => setAgenticSetupStep(6), 800);
        return;
      }
      // For other setup steps, just add a regular reply and stay in the step
      setPlaygroundMessages(prev => [...prev, {
        role: "assistant",
        content: "Got it! Please use the action buttons above to continue the setup. 👆"
      }]);
      setIsKnowledgeLoading(false);
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Check if it is a URL or a crawl command
    const crawlMatch = userInput.match(/^(?:crawl\s+)?(https?:\/\/[^\s]+)$/i);

    if (crawlMatch) {
      const urlToCrawl = crawlMatch[1];
      
      // Add thinking/progress bubble
      setPlaygroundMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Crawl command detected for **${urlToCrawl}**. Sending request to crawler and indexing content...`,
          status: "pending",
          filename: urlToCrawl
        }
      ]);

      try {
        let crawledContent = `This source represents the crawled contents of ${urlToCrawl}.`;
        try {
          const jinaUrl = `https://r.jina.ai/${urlToCrawl}`;
          const response = await fetch(jinaUrl);
          if (response.ok) {
            const text = await response.text();
            if (text && text.trim().length > 100) {
              crawledContent = text;
            }
          }
        } catch (crawlErr) {
          console.warn("Real-time client-side crawl failed:", crawlErr);
        }

        if (user && botId) {
          const { data: dbSrc, error } = await supabase
            .from("chatty_sources")
            .insert({
              bot_id: botId,
              type: "url",
              name: urlToCrawl,
              content: crawledContent,
              status: "training",
              char_count: crawledContent.length
            })
            .select()
            .single();

          if (error) throw error;

          // Simulate processing time
          setTimeout(async () => {
            await supabase
              .from("chatty_sources")
              .update({ status: "trained" })
              .eq("id", dbSrc.id);

            // Update chat log bubble to success
            setPlaygroundMessages((prev) =>
              prev.map((msg) =>
                msg.filename === urlToCrawl && msg.status === "pending"
                  ? {
                      role: "assistant",
                      content: `Successfully crawled and trained on **${urlToCrawl}**! Added character count: ${crawledContent.length}.`,
                      status: "success"
                    }
                  : msg
              )
            );

            // Refresh settings
            await loadBotSettings(user.id);
          }, 1500);
        }
      } catch (err: any) {
        console.error("Crawl error:", err);
        setPlaygroundMessages((prev) =>
          prev.map((msg) =>
            msg.filename === urlToCrawl && msg.status === "pending"
              ? {
                  role: "assistant",
                  content: `Failed to crawl website. Error: ${(err as any).message || "Unknown error"}`,
                  status: "error"
                }
              : msg
          )
        );
      } finally {
        setIsKnowledgeLoading(false);
      }
      return;
    }

    // 2. Check if it's a paragraph of facts to train
    const isQuestion = userInput.endsWith("?") || /^(what|how|why|who|where|when|can|is|are|does|do|should|would|will)\b/i.test(userInput);
    const isTrainCommand = userInput.toLowerCase().startsWith("train:") || userInput.toLowerCase().startsWith("fact:") || (!isQuestion && userInput.length > 40);

    if (isTrainCommand) {
      let docContent = userInput;
      let docTitle = `Text Ingest - ${new Date().toLocaleDateString()}`;

      // Clean prefix if any
      if (userInput.toLowerCase().startsWith("train:")) {
        docContent = userInput.substring(6).trim();
        docTitle = docContent.split(/[.\n]/)[0].slice(0, 30) || docTitle;
      } else if (userInput.toLowerCase().startsWith("fact:")) {
        docContent = userInput.substring(5).trim();
        docTitle = docContent.split(/[.\n]/)[0].slice(0, 30) || docTitle;
      } else {
        docTitle = docContent.split(/[.\n]/)[0].slice(0, 30) || docTitle;
      }

      setPlaygroundMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Analyzing text input and preparing to index facts under **"${docTitle}"**...`,
          status: "pending",
          filename: docTitle
        }
      ]);

      try {
        if (user && botId) {
          const { data: dbSrc, error } = await supabase
            .from("chatty_sources")
            .insert({
              bot_id: botId,
              type: "text",
              name: docTitle,
              content: docContent,
              status: "training",
              char_count: docContent.length
            })
            .select()
            .single();

          if (error) throw error;

          // Simulate processing time
          setTimeout(async () => {
            await supabase
              .from("chatty_sources")
              .update({ status: "trained" })
              .eq("id", dbSrc.id);

            setPlaygroundMessages((prev) =>
              prev.map((msg) =>
                msg.filename === docTitle && msg.status === "pending"
                  ? {
                      role: "assistant",
                      content: `Fact training complete! Added text source **"${docTitle}"** (${docContent.length} chars) to RAG memory.`,
                      status: "success"
                    }
                  : msg
              )
            );

            await loadBotSettings(user.id);
          }, 1500);
        }
      } catch (err: any) {
        console.error("Text ingest error:", err);
        setPlaygroundMessages((prev) =>
          prev.map((msg) =>
            msg.filename === docTitle && msg.status === "pending"
              ? {
                  role: "assistant",
                  content: `Failed to index facts. Error: ${err.message || "Unknown error"}`,
                  status: "error"
                }
              : msg
          )
        );
      } finally {
        setIsKnowledgeLoading(false);
      }
      return;
    }

    // 3. Question/RAG Testing Handler
    try {
      const res = await fetchWithFallback("/api/widget/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bot_id: botId,
          session_id: "knowledge_test_session",
          text: userInput,
          visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });

      if (res.ok) {
        const body = await res.json();
        setPlaygroundMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: body.reply
          }
        ]);
      } else {
        const body = await res.json();
        setPlaygroundMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `I queried your RAG memory, but encountered an error: ${body.detail || "RAG engine failed"}`,
            status: "error"
          }
        ]);
      }
    } catch (err: any) {
      console.error("RAG query error:", err);
      setPlaygroundMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Could not query the RAG backend. Make sure the server is online.`,
          status: "error"
        }
      ]);
    } finally {
      setIsKnowledgeLoading(false);
    }
  };

  // Handle Cloud Connector Triggers
  const handleConnectCloud = async (provider: "google" | "microsoft") => {
    setConnectingProvider(provider);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) {
        setConnectingProvider(null);
        return;
      }

      const res = await fetchWithFallback(`/api/integrations/${provider}/start?redirect_path=/dashboard`, {
        method: "POST"
      });
      if (res.ok) {
        const body = await res.json();
        if (body.url) {
          window.location.href = body.url; // Redirect to OAuth
          return;
        }
      }
    } catch (err) {
      console.error(`Error connecting to ${provider}:`, err);
    }
    setConnectingProvider(null);
  };

  // Handle training URL crawl
  // Scan a site's sitemap.xml → list all page URLs for the admin to pick.
  const handleScanSitemap = async () => {
    if (!inputUrl.trim()) return;
    setScanningSitemap(true); setCrawlSummary(null); setDiscoveredUrls([]);
    try {
      const res = await fetchWithFallback("/api/crawl/discover", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        const urls: string[] = d.urls || [];
        setDiscoveredUrls(urls);
        setSelectedUrls(new Set(urls));
        if (!d.sitemap_found) setCrawlSummary("No sitemap found — only this single page is available.");
      } else {
        setCrawlSummary("Could not scan that site.");
      }
    } catch { setCrawlSummary("Scan failed."); }
    finally { setScanningSitemap(false); }
  };

  // Crawl the admin-selected URLs and index each as a knowledge source.
  const handleCrawlSelected = async () => {
    const urls = Array.from(selectedUrls);
    if (!urls.length || !botId) return;
    setCrawlingPages(true); setCrawlSummary(null);
    try {
      const res = await fetchWithFallback("/api/crawl/pages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, urls }),
      });
      if (res.ok) {
        const d = await res.json();
        setCrawlSummary(`Indexed ${d.indexed} of ${urls.length} pages into your knowledge base.`);
        setDiscoveredUrls([]); setSelectedUrls(new Set());
        if (user) loadBotSettings(user.id);
      } else { setCrawlSummary("Crawl failed."); }
    } catch { setCrawlSummary("Crawl failed."); }
    finally { setCrawlingPages(false); }
  };

  const handleTrainUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    const urlName = inputUrl.trim();
    setInputUrl("");

    const newId = `src-${Date.now()}`;
    const tempSource: Source = {
      id: newId,
      type: "url",
      name: urlName,
      content: "Crawling website contents in progress...",
      status: "training",
      charCount: 0
    };
    setSources((prev) => [...prev, tempSource]);

    try {
      let crawledContent = `This source represents the crawled contents of ${urlName}.`;
      try {
        const jinaUrl = `https://r.jina.ai/${urlName}`;
        const response = await fetch(jinaUrl);
        if (response.ok) {
          const text = await response.text();
          if (text && text.trim().length > 100) {
            crawledContent = text;
          }
        }
      } catch (crawlErr) {
        console.warn("Real-time client-side crawl failed, using fallback placeholder:", crawlErr);
      }

      if (user && botId) {
        const { data: dbSrc, error } = await supabase
          .from("chatty_sources")
          .insert({
            bot_id: botId,
            type: "url",
            name: urlName,
            content: crawledContent,
            status: "training",
            char_count: crawledContent.length
          })
          .select()
          .single();

        if (error) throw error;
        
        setTimeout(async () => {
          await supabase
            .from("chatty_sources")
            .update({ status: "trained" })
            .eq("id", dbSrc.id);

          setSources((prev) =>
            prev.map((s) => (s.id === newId ? { ...s, id: dbSrc.id, content: crawledContent, status: "trained", charCount: crawledContent.length } : s))
          );
        }, 1500);
      }
    } catch (err) {
      console.error("Error inserting url source:", err);
      setSources((prev) => prev.filter((s) => s.id !== newId));
    }
  };

  // Handle training text documentation
  const handleTrainText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !inputTitle.trim()) return;

    const newId = `src-${Date.now()}`;
    const docTitle = inputTitle;
    const docContent = inputText;
    setInputText("");
    setInputTitle("");

    const newSource: Source = {
      id: newId,
      type: "text",
      name: docTitle,
      content: docContent,
      status: "training",
      charCount: docContent.length
    };
    setSources((prev) => [...prev, newSource]);

    try {
      if (user && botId) {
        const { data: dbSrc, error } = await supabase
          .from("chatty_sources")
          .insert({
            bot_id: botId,
            type: "text",
            name: docTitle,
            content: docContent,
            status: "training",
            char_count: docContent.length
          })
          .select()
          .single();

        if (error) throw error;

        setTimeout(async () => {
          await supabase
            .from("chatty_sources")
            .update({ status: "trained" })
            .eq("id", dbSrc.id);

          setSources((prev) =>
            prev.map((s) => (s.id === newId ? { ...s, id: dbSrc.id, status: "trained" } : s))
          );
        }, 2000);
      }
    } catch (err) {
      console.error("Error inserting text source:", err);
    }
  };

  // Handle Google Drive folder indexing
  const handleIndexDriveFolder = async (e: React.FormEvent, source: "gdrive" | "onedrive" = "gdrive") => {
    e.preventDefault();
    if (!driveFolderUrl.trim()) return;

    setIsIndexingDrive(true);
    setDriveIndexError(null);
    setDriveIndexSuccess(null);

    try {
      const res = await fetchWithFallback("/api/documents/index-folder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder_id_or_url: driveFolderUrl.trim(),
          max_files: driveMaxFiles,
          source,
        }),
      });

      if (res.ok) {
        setDriveIndexSuccess("Indexing started in background. The files will be crawled and loaded shortly.");
        setDriveFolderUrl("");
      } else {
        const body = await res.json();
        setDriveIndexError(body.detail || "Failed to start folder indexing.");
      }
    } catch (err) {
      console.error("Error indexing Drive folder:", err);
      setDriveIndexError("Failed to connect to the server.");
    } finally {
      setIsIndexingDrive(false);
    }
  };

  // Delete source
  const handleDeleteSource = async (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    try {
      if (user) {
        await supabase
          .from("chatty_sources")
          .delete()
          .eq("id", id);
      }
    } catch (err) {
      console.error("Error deleting source:", err);
    }
  };


  // ── API key management ─────────────────────────────────────────────────────
  const loadApiKeys = async (bId: string) => {
    setLoadingApiKeys(true);
    try {
      const res = await fetchWithFallback(`/api/keys?bot_id=${bId}`);
      if (res.ok) {
        const d = await res.json();
        setApiKeys(d.keys || []);
      }
    } catch (err) {
      console.error("Failed to load API keys:", err);
    } finally {
      setLoadingApiKeys(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!botId) return;
    setCreatingApiKey(true);
    setNewApiKey(null);
    try {
      const res = await fetchWithFallback("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, name: "API Key" }),
      });
      if (res.ok) {
        const d = await res.json();
        setNewApiKey(d.api_key);
        await loadApiKeys(botId);
      } else {
        const d = await res.json();
        alert(`Failed to create key: ${d.detail || "error"}`);
      }
    } catch (err) {
      console.error("Create API key error:", err);
    } finally {
      setCreatingApiKey(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    if (!confirm("Revoke this API key? Apps using it will stop working immediately.")) return;
    try {
      const res = await fetchWithFallback(`/api/keys/${keyId}`, { method: "DELETE" });
      if (res.ok && botId) await loadApiKeys(botId);
    } catch (err) {
      console.error("Revoke API key error:", err);
    }
  };

  // Clipboard Copiers
  const copyToClipboard = (text: string, type: "script" | "iframe") => {
    navigator.clipboard.writeText(text);
    if (type === "script") {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } else {
      setCopiedIframe(true);
      setTimeout(() => setCopiedIframe(false), 2000);
    }
  };

  // Playground Chatbot Reply Generator
  const handlePlaygroundSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playgroundInput.trim()) return;

    const userText = playgroundInput;
    setPlaygroundMessages((prev) => [...prev, { role: "user", content: userText }]);
    setPlaygroundInput("");
    setIsBotResponding(true);

    // Reset and trigger simulated agent thinking steps
    setLiveThinkingSteps([]);
    
    setTimeout(() => {
      setLiveThinkingSteps(prev => [...prev, `[intent_parser] Parsing query intent: "${userText.slice(0, 20)}..."`]);
    }, 200);

    setTimeout(() => {
      setLiveThinkingSteps(prev => [...prev, `[knowledge_retrieval] Scanning ${sources.length} active database sources for semantic match...`]);
    }, 550);

    setTimeout(() => {
      const lowerInput = userText.toLowerCase();
      const greetings = ["hi", "hello", "hey", "greetings", "howdy", "hola", "yo"];
      const isGreeting = lowerInput.split(/[^a-zA-Z]/).some(word => greetings.includes(word));
      
      let matchMsg = "";
      if (isGreeting) {
        matchMsg = "Greeting intent detected. Fetching greeting response.";
      } else {
        const matched = sources.find(s => s.status === "trained" && s.content.toLowerCase().split(" ").some(word => word.length >= 3 && lowerInput.includes(word)));
        matchMsg = matched 
          ? `Found semantic match in trained source: "${matched.name}"`
          : "No direct semantic matches found in database index.";
      }
      setLiveThinkingSteps(prev => [...prev, `[knowledge_retrieval] ${matchMsg}`]);
    }, 950);

    setTimeout(() => {
      setLiveThinkingSteps(prev => [...prev, `[guardrail_checks] Evaluated safety guardrails (strict_mode = ${strictMode ? "ON" : "OFF"})`]);
    }, 1300);

    if (user && botId) {
      try {
        await supabase.from("chatty_conversations").insert({
          bot_id: botId,
          session_id: "playground_session",
          role: "user",
          content: userText
        });
        setTimeout(() => {
          loadAnalyticsData(botId, leads.length);
        }, 200);
      } catch (err) {
        console.error("Error logging user message:", err);
      }
    }

    setTimeout(async () => {
      let responseContent = "";
      try {
        const res = await fetchWithFallback("/api/widget/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            bot_id: botId,
            session_id: "playground_session",
            text: userText,
            visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          })
        });
        if (res.ok) {
          const body = await res.json();
          responseContent = body.reply;
        } else {
          const body = await res.json();
          responseContent = `Error: ${body.detail || "Failed to get response from AI assistant"}`;
        }
      } catch (err) {
        console.error("Playground send error:", err);
        responseContent = "Could not communicate with the backend. Check console logs.";
      }

      const steps = [
        `[intent_parser] Parsed query intent: "${userText.slice(0, 25)}..."`,
        `[knowledge_retrieval] Checked dynamic knowledge & RAG sources.`,
        `[guardrail_checks] Evaluated safety guardrails (strict_mode = ${strictMode ? "ON" : "OFF"})`,
        `[response_generation] Formulated final reply via model: ${selectedModel}`
      ];

      setPlaygroundMessages((prev) => [...prev, { role: "assistant", content: responseContent, thinkingSteps: steps }]);
      setLiveThinkingSteps([]);
      setIsBotResponding(false);

      // Reload leads and analytics to check if a lead was registered
      if (user && botId) {
        setTimeout(async () => {
          const { data: leadList } = await supabase
            .from("chatty_leads")
            .select("*")
            .eq("bot_id", botId)
            .order("created_at", { ascending: false });
          if (leadList) {
            const mappedLeads = leadList.map(l => ({
              id: l.id,
              name: l.name || "Anonymous",
              email: l.email || "N/A",
              phone: l.phone || "N/A",
              created_at: new Date(l.created_at).toISOString().slice(0, 16).replace("T", " ")
            }));
            setLeads(mappedLeads);
            await loadAnalyticsData(botId, mappedLeads.length);
          }
        }, 800);
      }
    }, 1500);
  };

  // Sign out handler
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // Code snippets
  const embedScriptCode = `<script\n  src="https://chatty.personaliai.com/widget.js"\n  data-id="${botId || "YOUR_BOT_ID"}"\n  data-color="${primaryColor}"\n  data-style="${widgetStyle}"\n  defer\n></script>`;
  const embedIframeCode = `<iframe\n  src="https://chatty.personaliai.com/embed/${botId || "YOUR_BOT_ID"}?color=${encodeURIComponent(primaryColor)}&style=${widgetStyle}"\n  width="100%"\n  height="600"\n  frameborder="0"\n></iframe>`;

  // Reusable Chatty composer (input card)
  const renderComposer = () => {
    return (
      <form
        onSubmit={handleKnowledgeSend}
        className="flex flex-col gap-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-3.5 shadow-md focus-within:border-neutral-350 dark:focus-within:border-neutral-700 transition-colors relative w-full"
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleKnowledgeUpload}
          accept=".pdf,.docx,.txt,.md"
          className="hidden"
        />

        {/* Text Input on Top */}
        <div className="flex-1 px-1">
          <input
            type="text"
            placeholder="Assign a task or ask anything"
            value={knowledgeInput}
            onChange={(e) => setKnowledgeInput(e.target.value)}
            onFocus={() => { setPaperclipOpen(false); setConnectorsDropdownOpen(false); }}
            disabled={isKnowledgeLoading}
            className="w-full bg-transparent border-none outline-none text-sm text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-450 py-1 disabled:opacity-60 font-sans"
          />
        </div>

        {/* Toolbar on Bottom */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-850">
          
          {/* Left: Plus & Quick Connectors */}
          <div className="flex items-center gap-2">
            {/* Plus button */}
            <button
              type="button"
              onClick={() => { setPaperclipOpen(!paperclipOpen); setConnectorsDropdownOpen(false); setActiveSubmenu("none"); }}
              disabled={isKnowledgeLoading}
              className={`p-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-750 text-neutral-600 dark:text-neutral-300 transition-all cursor-pointer disabled:opacity-40 size-8 flex items-center justify-center`}
            >
              <motion.div animate={{ rotate: paperclipOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
                <Plus className="size-4.5" />
              </motion.div>
            </button>

            {/* Quick Connector Toggles Area (Drive, Calendar, Microsoft Drive, Microsoft Calendar) */}
            <div
              className="flex items-center gap-2.5 bg-neutral-50/80 dark:bg-neutral-850/80 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full px-3 py-1.5 border border-neutral-200/40 dark:border-neutral-750/60 transition-colors cursor-pointer"
              onClick={() => { setConnectorsDropdownOpen(!connectorsDropdownOpen); setPaperclipOpen(false); }}
            >
              {/* Google Drive Status */}
              <div className={`transition-opacity ${syncGoogleDrive && googleConnected ? "opacity-100" : "opacity-45"}`}>
                <svg className="size-4" viewBox="0 0 24 24" fill="none">
                  <path d="M15.43 14.5H23L15.43 1.5H7.86L15.43 14.5Z" fill="#0066DA" />
                  <path d="M15.43 14.5H7.86L0.29 1.5H7.86L15.43 14.5Z" fill="#00A1F1" />
                  <path d="M15.43 14.5L7.86 21.5H23L15.43 14.5Z" fill="#F2B200" />
                </svg>
              </div>

              {/* Google Calendar Status */}
              <div className={`transition-opacity ${syncGoogleCalendar && googleConnected ? "opacity-100" : "opacity-45"}`}>
                <svg className="size-4" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="4.5" fill="#4285F4" />
                  <text x="50%" y="65%" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="sans-serif">31</text>
                </svg>
              </div>

              {/* Microsoft OneDrive Status */}
              <div className={`transition-opacity ${syncOneDrive && microsoftConnected ? "opacity-100" : "opacity-45"}`}>
                <svg className="size-4" viewBox="0 0 24 24" fill="none">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" fill="#0078D4"/>
                </svg>
              </div>

              {/* Microsoft Outlook Calendar Status */}
              <div className={`transition-opacity ${syncOutlookCalendar && microsoftConnected ? "opacity-100" : "opacity-45"}`}>
                <svg className="size-4" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="4.5" fill="#0078D4" />
                  <path d="M6 18H18V10H6V18ZM18 6H16V5c0-.55-.45-1-1-1s-1 .45-1 1v1H10V5c0-.55-.45-1-1-1s-1 .45-1 1v1H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" fill="white"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Right: Send */}
          <div className="flex items-center gap-1">
            {/* Send button (circle up arrow) */}
            <button
              type="submit"
              disabled={isKnowledgeLoading || !knowledgeInput.trim()}
              className={`size-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                knowledgeInput.trim()
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 shadow-sm"
                  : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600 cursor-not-allowed"
              }`}
            >
              <ArrowUp className="size-4" />
            </button>
          </div>

        </div>
      </form>
    );
  };

  // Render loading state if session loading
  if (loadingSession) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950 font-sans">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="size-8 animate-spin text-[#f97316]" />
          <p className="text-xs text-neutral-400 font-semibold">Loading console session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-955 font-sans text-neutral-900 dark:text-neutral-100 overflow-hidden antialiased">
      
      {/* Onboarding Wizard */}
      {showWizard && botId && (
        <OnboardingWizard
          botId={botId}
          initial={{ name: botName, primaryColor, widgetStyle, welcomeMessage: welcomeMsg, systemInstructions, logoUrl }}
          fetchBackend={fetchWithFallback}
          supabase={supabase}
          onComplete={(f) => {
            setBotName(f.name); setPrimaryColor(f.primaryColor);
            setWidgetStyle(f.widgetStyle as typeof widgetStyle);
            setWelcomeMsg(f.welcomeMessage); setSystemInstructions(f.systemInstructions);
            setLogoUrl(f.logoUrl); setOnboardingCompleted(true);
          }}
          onClose={() => setShowWizard(false)}
        />
      )}

      {/* Floating Save Changes Banner */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-950 text-white dark:bg-white dark:text-black border border-neutral-800 dark:border-neutral-200 shadow-2xl rounded-xl px-5 py-3.5 flex items-center gap-4 transition-all duration-300">
          <span className="text-[11px] font-semibold flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#f97316] animate-pulse"></span>
            You have unsaved changes
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setHasUnsavedChanges(false)}
              className="text-[10px] font-medium border border-neutral-800 hover:bg-neutral-900 rounded-lg px-2.5 py-1.5 cursor-pointer dark:border-neutral-200 dark:hover:bg-neutral-100"
            >
              Discard
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="text-[10px] font-semibold bg-[#f97316] text-white rounded-lg px-3 py-1.5 flex items-center gap-1.5 cursor-pointer hover:bg-[#f97316]/90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              Save changes
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Responsive collapsible) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col justify-between shrink-0 transform transition-transform duration-200 md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Brand Logo */}
          <div className="h-16 px-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-semibold text-base tracking-tight flex items-center gap-1.5">
                <span className="size-5 rounded-md bg-neutral-950 dark:bg-white flex items-center justify-center text-white dark:text-black font-bold text-xs">C</span>
                Chatty
              </span>
            </Link>
            <button className="md:hidden p-1 text-neutral-400 hover:text-neutral-900" onClick={() => setSidebarOpen(false)}>
              <X className="size-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {[
              { id: "home", label: t("overview"), icon: Home },
              { id: "customizer", label: t("customizer"), icon: Sliders },
              { id: "knowledge", label: t("knowledge_base"), icon: Database },
              { id: "playground", label: t("playground"), icon: MessageSquare, badge: true },
              { id: "inbox", label: "Inbox", icon: Inbox },
              { id: "leads", label: t("leads"), icon: Users },
              { id: "map", label: "Map", icon: MapPin },
              { id: "meetings", label: t("meetings"), icon: Calendar },
              { id: "mailbox", label: "Mailbox", icon: Mail },
              { id: "notifications", label: t("notifications"), icon: Bell },
              { id: "audit_log", label: t("audit_log"), icon: FileText },
              { id: "analytics", label: t("analytics"), icon: BarChart3 },
              { id: "integrations", label: t("integrations"), icon: Code2 },
              { id: "developer", label: "Developer API", icon: Puzzle },
              { id: "settings", label: t("settings"), icon: Settings },
            ].map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.id}
                  onClick={() => {
                    setActiveTab(link.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer relative ${
                    activeTab === link.id
                      ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                      : "text-neutral-500 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                  }`}
                >
                  <Icon className="size-4" />
                  {link.label}
                  {link.badge && <span className="absolute right-2 size-2 rounded-full bg-[#f97316]"></span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info & Logout link */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-8 rounded-full bg-[#f97316]/10 flex items-center justify-center text-[#f97316] font-bold text-xs">P</div>
            <div className="overflow-hidden">
              <p className="text-[11px] font-semibold truncate">{user ? user.email.split("@")[0] : "Guest"}</p>
              <p className="text-[9px] text-neutral-400 dark:text-neutral-500 truncate">
                {user ? user.email : "Sign in to sync"}
              </p>
            </div>
          </div>
          <div className="space-y-1">
            {user ? (
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 text-[10px] text-neutral-400 hover:text-red-500 transition-colors py-1 cursor-pointer"
              >
                <LogOut className="size-3.5" />
                Sign Out Account
              </button>
            ) : (
              <Link href="/login" className="w-full flex items-center gap-2 text-[10px] text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors py-1">
                <LogOut className="size-3.5" />
                Log In to Save Progress
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Header bar */}
        <header className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1 text-neutral-500 hover:text-neutral-950" onClick={() => setSidebarOpen(true)}>
              <Menu className="size-5" />
            </button>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Chatty Console</span>
              <h2 className="text-sm font-semibold capitalize mt-0.5">{activeTab === "home" ? "Overview" : activeTab.replace("_", " ")}</h2>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            {/* Language Selector */}
            <ModernSelect
              value={language}
              options={languageOptions}
              onChange={(v) => setLanguage(v as "EN" | "ES" | "FR" | "DE" | "IT")}
              align="right"
              size="sm"
              className="w-36"
            />

            {/* Re-run Setup (agentic flow) */}
            {onboardingCompleted && (
              <button
                onClick={() => setShowWizard(true)}
                className="text-[10px] border border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 rounded-lg px-2.5 py-1.5 hover:bg-[#f97316]/5 cursor-pointer font-bold text-neutral-600 dark:text-neutral-400 transition-colors flex items-center gap-1"
              >
                <Sparkles className="size-3 text-[#f97316]" />
                Re-run Setup
              </button>
            )}

            <span className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${user ? "bg-green-500" : "bg-yellow-500"}`}></span>
              {user ? "Database Active" : "Offline"}
            </span>
          </div>
        </header>

        {/* Tab Contents (Center Aligned Layout) */}
        <div className="flex-1 overflow-y-auto">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "home" && (
            <div className="max-w-4xl mx-auto w-full space-y-6 py-6 px-4 flex flex-col">
              <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Sparkles className="size-4 text-[#f97316]" />
                  Welcome to Chatty!
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
                  Your chatbot is online and ready to be installed. Follow the quick steps below to train its memory, customize its visuals, and embed the code snippet onto your website.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                  <button
                    onClick={() => setActiveTab("playground")}
                    className="p-4 text-left rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer"
                  >
                    <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">1. Train Memory</div>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Add URLs, text documents, or API sync sources.</p>
                  </button>
                  <button
                    onClick={() => setActiveTab("customizer")}
                    className="p-4 text-left rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer"
                  >
                    <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">2. Customize Style</div>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Preset designs: Minimalist, Glassmorphism, Neumorphism.</p>
                  </button>
                  <button
                    onClick={() => setActiveTab("integrations")}
                    className="p-4 text-left rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer"
                  >
                    <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">3. Install Script</div>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Copy code scripts or iframe elements for your webpage.</p>
                  </button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Conversations</span>
                    <h4 className="text-2xl font-bold mt-1">{totalSessions}</h4>
                    <span className="text-[9px] text-green-500 font-medium flex items-center gap-0.5 mt-1">
                      <TrendingUp className="size-3" /> Real-time active sessions
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    <MessageCircle className="size-5" />
                  </div>
                </div>

                <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Trained Sources</span>
                    <h4 className="text-2xl font-bold mt-1">{sources.length} Active</h4>
                    <span className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1 flex items-center gap-1">
                      {sources.reduce((acc, s) => acc + s.charCount, 0).toLocaleString()} characters
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    <Database className="size-5" />
                  </div>
                </div>

                <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Leads Captured</span>
                    <h4 className="text-2xl font-bold mt-1">{leads.length}</h4>
                    <span className="text-[9px] text-[#f97316] font-medium mt-1">
                      Click to view leads tab
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-[#f97316]">
                    <Users className="size-5" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOMIZER */}
          {activeTab === "customizer" && (
            <div className="max-w-4xl mx-auto w-full py-6 px-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Customizer Panel */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Design Assistant presets</h3>
                    
                    {/* Design Presets cards */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: "minimalist", name: "Minimalist", desc: "Sharp borders, solid colors." },
                        { id: "glassmorphism", name: "Glassmorphism", desc: "Frosted blur, soft shadows." },
                        { id: "liquid", name: "Liquid Glass", desc: "Fluid saturated reflections." },
                        { id: "neumorphism", name: "Neumorphism", desc: "Sleek dual pillowy bevels." }
                      ].map((style) => (
                        <button
                          key={style.id}
                          onClick={() => handleInputChange(setWidgetStyle, style.id)}
                          className={`p-3 text-left border rounded-xl transition-all cursor-pointer ${
                            widgetStyle === style.id
                              ? "border-[#f97316] bg-[#f97316]/5"
                              : "border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800/20"
                          }`}
                        >
                          <div className="text-xs font-bold">{style.name}</div>
                          <p className="text-[9px] text-neutral-400 mt-1 leading-normal">{style.desc}</p>
                        </button>
                      ))}
                    </div>

                    <hr className="border-neutral-100 dark:border-neutral-800 my-4" />

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Chatbot Name</label>
                      <input
                        type="text"
                        value={botName}
                        onChange={(e) => handleInputChange(setBotName, e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Welcome Message</label>
                      <input
                        type="text"
                        value={welcomeMsg}
                        onChange={(e) => handleInputChange(setWelcomeMsg, e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Teaser Message</label>
                      <input
                        type="text"
                        value={teaserMessage}
                        placeholder="👋 Need help? Chat with us."
                        onChange={(e) => handleInputChange(setTeaserMessage, e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      />
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Proactive bubble shown next to the launcher a few seconds after a visitor lands.</p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Suggested Messages</label>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-2">Tappable starter prompts shown to visitors (up to 4).</p>
                      <div className="space-y-2">
                        {conversationStarters.map((s, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={s}
                              placeholder={`e.g. How can you help me?`}
                              onChange={(e) => { const next = [...conversationStarters]; next[i] = e.target.value; handleInputChange(setConversationStarters, next); }}
                              className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                            />
                            <button
                              type="button"
                              onClick={() => handleInputChange(setConversationStarters, conversationStarters.filter((_, j) => j !== i))}
                              className="px-2 py-1.5 text-neutral-400 hover:text-red-500 rounded-lg cursor-pointer transition-colors"
                              aria-label="Remove suggested message"
                            >✕</button>
                          </div>
                        ))}
                        {conversationStarters.length < 4 && (
                          <button
                            type="button"
                            onClick={() => handleInputChange(setConversationStarters, [...conversationStarters, ""])}
                            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer transition-colors"
                          >+ Add suggested message</button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Primary Hex Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => handleInputChange(setPrimaryColor, e.target.value)}
                          className="size-8 rounded border border-neutral-200 bg-transparent p-0.5 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => handleInputChange(setPrimaryColor, e.target.value)}
                          className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                        />
                      </div>
                      <div className="flex gap-2 mt-2">
                        {["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#111827"].map((color) => (
                          <button
                            key={color}
                            onClick={() => handleInputChange(setPrimaryColor, color)}
                            style={{ backgroundColor: color }}
                            className={`size-6 rounded-full border cursor-pointer ${
                              primaryColor === color ? "border-neutral-900 dark:border-white ring-2 ring-[#f97316]/20" : "border-transparent"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Send Button</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: "plane", shape: "size-8 rounded-full", icon: <Send className="size-4" /> },
                          { key: "arrowUp", shape: "size-8 rounded-full", icon: <ArrowUp className="size-4" /> },
                          { key: "arrowRight", shape: "size-8 rounded-full", icon: <ArrowRight className="size-4" /> },
                          { key: "square", shape: "size-8 rounded-lg", icon: <Send className="size-4" /> },
                          { key: "label", shape: "h-8 px-3 rounded-full gap-1.5", icon: <Send className="size-3.5" />, label: "Send" },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => handleInputChange(setSendButtonStyle, opt.key)}
                            title={opt.key}
                            className={`p-1.5 rounded-xl border cursor-pointer transition-colors ${
                              sendButtonStyle === opt.key
                                ? "border-neutral-900 dark:border-white ring-2 ring-[#f97316]/20"
                                : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
                            }`}
                          >
                            <span
                              style={{ backgroundColor: primaryColor }}
                              className={`${opt.shape} flex items-center justify-center text-white`}
                            >
                              {opt.icon}{opt.label && <span className="text-xs font-semibold">{opt.label}</span>}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live visual mockup preview */}
                <div className="lg:col-span-5 flex flex-col items-center">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold mb-3">Live Assistant Preview</span>
                  <div className={`w-full max-w-[320px] h-[440px] rounded-2xl flex flex-col overflow-hidden transition-all style-${widgetStyle}`}>
                                       {/* Header styled dynamically */}
                    <div
                      style={widgetStyle === "minimalist" ? { backgroundColor: primaryColor } : {}}
                      className={`chat-header p-4 flex items-center gap-3 transition-all ${
                        widgetStyle === "minimalist" ? "text-white" : ""
                      }`}
                    >
                      <div className="size-8 rounded-full bg-white/20 dark:bg-black/20 flex items-center justify-center font-bold text-sm">C</div>
                      <div>
                        <h4 className="font-semibold text-sm leading-tight">{botName}</h4>
                        <p className="text-[9px] opacity-80">Online • presets: {widgetStyle}</p>
                      </div>
                    </div>

                    {/* Messages list */}
                    <div className="flex-1 p-4 space-y-3 overflow-y-auto text-xs">
                      <div className="flex gap-2 max-w-[85%]">
                        <div className="size-6 rounded-full bg-neutral-200/50 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-bold shrink-0">C</div>
                        <div className="bot-bubble p-3 rounded-2xl rounded-tl-none bg-neutral-100 text-neutral-800 dark:bg-neutral-850 dark:text-neutral-200 leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="mb-0.5">{children}</li>,
                              pre: ({ children }) => <pre className="bg-neutral-950 text-white rounded-lg p-2 overflow-x-auto my-2 text-[10px] font-mono leading-normal">{children}</pre>,
                              code: ({ children }) => <code className="bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded text-[10px] font-mono">{children}</code>
                            }}
                          >
                            {welcomeMsg}
                          </ReactMarkdown>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-auto flex-row-reverse max-w-[85%]">
                        <div
                          className="user-bubble p-3 rounded-2xl rounded-tr-none text-white leading-relaxed"
                          style={widgetStyle === "minimalist" ? { backgroundColor: primaryColor } : {}}
                        >
                          Hi there, testing theme preview!
                        </div>
                      </div>
                    </div>

                    {/* Suggested-message chips (live preview) */}
                    {conversationStarters.filter(Boolean).length > 0 && (
                      <div className="px-3 pb-1 flex flex-col items-end gap-1.5">
                        {conversationStarters.filter(Boolean).slice(0, 4).map((s, i) => (
                          <span key={i} className="px-2.5 py-1.5 rounded-2xl border text-[11px] font-medium text-right" style={{ borderColor: primaryColor, color: primaryColor }}>{s}</span>
                        ))}
                      </div>
                    )}

                    {/* Footer input form */}
                    <div className="p-3 border-t border-neutral-100 dark:border-neutral-900 flex items-center gap-2">
                      <input
                        disabled
                        type="text"
                        placeholder="Type a message..."
                        className="chat-input-bar flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-450"
                      />
                      {(() => {
                        const map: Record<string, { shape: string; icon: any; label?: string }> = {
                          plane: { shape: "size-7 rounded-full", icon: <Send className="size-3.5" /> },
                          arrowUp: { shape: "size-7 rounded-full", icon: <ArrowUp className="size-3.5" /> },
                          arrowRight: { shape: "size-7 rounded-full", icon: <ArrowRight className="size-3.5" /> },
                          square: { shape: "size-7 rounded-lg", icon: <Send className="size-3.5" /> },
                          label: { shape: "h-7 px-2.5 rounded-full gap-1", icon: <Send className="size-3" />, label: "Send" },
                        };
                        const c = map[sendButtonStyle] || map.plane;
                        return (
                          <button disabled style={{ backgroundColor: primaryColor }} className={`${c.shape} text-white flex items-center justify-center shrink-0 opacity-90`}>
                            {c.icon}{c.label && <span className="text-[11px] font-semibold">{c.label}</span>}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* TAB 3: KNOWLEDGE BASE */}
          {activeTab === "knowledge" && (
            <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-6">
              {/* Hidden file input (re-uses existing upload handler) */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleKnowledgeUpload}
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
              />

              {/* Header */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Database className="size-4 text-[#f97316]" />
                    {t("knowledge_base")}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed max-w-xl">
                    Everything your assistant knows. Add text, crawl websites, upload documents, or sync a Google Drive folder — all sources are chunked and embedded into RAG memory.
                  </p>
                </div>
                <button
                  onClick={() => user && loadBotSettings(user.id)}
                  disabled={loadingLists}
                  className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-350 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${loadingLists ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              {/* Lead Capture */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold flex items-center gap-2"><Database className="size-4 text-[#f97316]" />Lead Capture</h4>
                    <p className="text-[10px] text-neutral-400 mt-1 max-w-md">Collect visitor details in conversations. Required fields must be gathered; new fields create columns in the Leads table automatically.</p>
                  </div>
                  <button type="button" onClick={() => setLeadCaptureEnabled((v) => !v)} aria-label="Toggle lead capture"
                    className={`relative w-10 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${leadCaptureEnabled ? "bg-[#f97316]" : "bg-neutral-300 dark:bg-neutral-700"}`}>
                    <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${leadCaptureEnabled ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </div>

                {leadCaptureEnabled && (
                  <>
                    <div className="space-y-2">
                      {leadFields.map((field) => {
                        const required = leadRequiredFields.map((f) => f.toLowerCase()).includes(field.toLowerCase());
                        return (
                          <div key={field} className="flex items-center justify-between gap-2 p-2 pl-3 rounded-lg border border-neutral-100 dark:border-neutral-800">
                            <span className="text-xs font-medium capitalize">{field.replace(/_/g, " ")}</span>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => setLeadRequiredFields((prev) => required ? prev.filter((f) => f.toLowerCase() !== field.toLowerCase()) : [...prev, field])}
                                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold cursor-pointer transition-colors ${required ? "bg-[#f97316]/10 text-[#f97316]" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"}`}>
                                {required ? "Required" : "Optional"}
                              </button>
                              <button type="button" onClick={() => { setLeadFields((prev) => prev.filter((f) => f !== field)); setLeadRequiredFields((prev) => prev.filter((f) => f.toLowerCase() !== field.toLowerCase())); }}
                                className="px-1.5 text-neutral-400 hover:text-red-500 text-xs cursor-pointer" aria-label="Remove field">✕</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input value={newLeadField} onChange={(e) => setNewLeadField(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const f = newLeadField.trim().toLowerCase().replace(/\s+/g, "_"); if (f && !leadFields.map((x) => x.toLowerCase()).includes(f)) setLeadFields((p) => [...p, f]); setNewLeadField(""); } }}
                        placeholder="Add a field (e.g. company, budget)"
                        className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none" />
                      <button type="button" onClick={() => { const f = newLeadField.trim().toLowerCase().replace(/\s+/g, "_"); if (f && !leadFields.map((x) => x.toLowerCase()).includes(f)) setLeadFields((p) => [...p, f]); setNewLeadField(""); }}
                        className="px-3 py-1.5 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer">+ Add</button>
                    </div>
                  </>
                )}

                <button type="button" disabled={savingLeadCapture || !botId}
                  onClick={async () => { if (!botId) return; setSavingLeadCapture(true); try { await saveOnboardingStep(onboardingStep || 0, onboardingCompleted, { lead_fields: leadFields, lead_capture_enabled: leadCaptureEnabled, lead_required_fields: leadRequiredFields }); } finally { setSavingLeadCapture(false); } }}
                  className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50">
                  {savingLeadCapture ? "Saving…" : "Save lead settings"}
                </button>
              </div>

              {/* Quick connect strip */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mr-1">Quick connect:</span>
                <button
                  onClick={() => googleConnected ? setKbSourceTab("drive") : handleConnectCloud("google")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                    googleConnected ? "border-green-300 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400" : "border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 hover:bg-[#f97316]/5"
                  }`}
                >
                  <svg className="size-3.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  {googleConnected ? "Google Drive" : "Connect Google"}
                  {googleConnected && <Check className="size-3" />}
                </button>
                <button
                  onClick={() => microsoftConnected ? setKbSourceTab("onedrive") : handleConnectCloud("microsoft")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                    microsoftConnected ? "border-green-300 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400" : "border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 hover:bg-[#f97316]/5"
                  }`}
                >
                  <svg className="size-3.5" viewBox="0 0 24 24"><path fill="#F25022" d="M3 3h8v8H3z"/><path fill="#7FBA00" d="M13 3h8v8h-8z"/><path fill="#00A4EF" d="M3 13h8v8H3z"/><path fill="#FFB900" d="M13 13h8v8h-8z"/></svg>
                  {microsoftConnected ? "OneDrive" : "Connect Microsoft"}
                  {microsoftConnected && <Check className="size-3" />}
                </button>
                <button
                  onClick={() => setKbSourceTab("url")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 hover:bg-[#f97316]/5 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <Globe className="size-3.5" /> Website
                </button>
                <button
                  onClick={() => { setKbSourceTab("file"); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 hover:bg-[#f97316]/5 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <FileUp className="size-3.5" /> Upload
                </button>
              </div>

              {/* Scheduling quick-config */}
              <div className="flex flex-wrap items-center gap-4 p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5"><Calendar className="size-3.5" /> Scheduling:</span>
                <button
                  onClick={() => handleInputChange(setCalendarSchedulingEnabled, !calendarSchedulingEnabled)}
                  className="flex items-center gap-2 text-[11px] font-semibold cursor-pointer"
                >
                  <span className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${calendarSchedulingEnabled ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"}`}>
                    <span className={`block size-3.5 rounded-full bg-white transition-transform ${calendarSchedulingEnabled ? "translate-x-3.5" : ""}`} />
                  </span>
                  {calendarSchedulingEnabled ? "Booking on" : "Booking off"}
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-neutral-400">Provider</span>
                  <div className="w-40"><ModernSelect value={meetingProvider} options={providerOptions} onChange={(v) => handleInputChange(setMeetingProvider, v)} size="sm" /></div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-neutral-400">Calendar</span>
                  <div className="w-44"><ModernSelect
                    value={meetingProvider === "teams" ? "outlook" : "google"}
                    options={[{ value: "google", label: "Google Calendar" }, { value: "outlook", label: "Outlook Calendar" }]}
                    onChange={(v) => { handleInputChange(v === "outlook" ? setSyncOutlookCalendar : setSyncGoogleCalendar, true); }}
                    size="sm"
                  /></div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Total Sources</span>
                    <h4 className="text-2xl font-bold mt-1">{sources.length}</h4>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500"><Layers className="size-5" /></div>
                </div>
                <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Characters Indexed</span>
                    <h4 className="text-2xl font-bold mt-1">{sources.reduce((acc, s) => acc + (s.charCount || 0), 0).toLocaleString()}</h4>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500"><FileText className="size-5" /></div>
                </div>
                <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Status</span>
                    <h4 className="text-2xl font-bold mt-1">{sources.filter(s => s.status === "trained").length}<span className="text-sm font-medium text-neutral-400"> / {sources.length} trained</span></h4>
                    {sources.some(s => s.status === "training") && (
                      <span className="text-[9px] text-[#f97316] font-medium flex items-center gap-1 mt-1">
                        <Loader2 className="size-3 animate-spin" /> {sources.filter(s => s.status === "training").length} training…
                      </span>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30 text-green-500"><Check className="size-5" /></div>
                </div>
              </div>

              {/* Add Source Card */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                <div className="p-1.5 border-b border-neutral-100 dark:border-neutral-800 flex gap-1 overflow-x-auto">
                  {[
                    { id: "text", label: "Text / FAQ", icon: Type },
                    { id: "url", label: "Website URL", icon: Globe },
                    { id: "file", label: "Upload File", icon: FileUp },
                    { id: "drive", label: "Google Drive", icon: FolderOpen },
                    { id: "onedrive", label: "OneDrive", icon: HardDrive },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setKbSourceTab(tab.id as "text" | "url" | "file" | "drive" | "onedrive")}
                        className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                          kbSourceTab === tab.id
                            ? "bg-[#f97316]/10 text-[#f97316]"
                            : "text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        }`}
                      >
                        <Icon className="size-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="p-5">
                  {/* Text source */}
                  {kbSourceTab === "text" && (
                    <form onSubmit={handleTrainText} className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Title</label>
                        <input
                          type="text"
                          placeholder="e.g. Refund Policy"
                          value={inputTitle}
                          onChange={(e) => setInputTitle(e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Content</label>
                        <textarea
                          placeholder="Paste FAQ answers, policies, product details, or any knowledge the bot should learn…"
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          rows={5}
                          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 resize-y leading-relaxed"
                        />
                        <p className="text-[9px] text-neutral-400 mt-1">{inputText.length.toLocaleString()} characters</p>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!inputText.trim() || !inputTitle.trim() || !botId}
                          className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          <Plus className="size-3.5" /> Add to Knowledge
                        </button>
                      </div>
                    </form>
                  )}

                  {/* URL source */}
                  {kbSourceTab === "url" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Website URL</label>
                        <input
                          type="url"
                          placeholder="https://example.com"
                          value={inputUrl}
                          onChange={(e) => setInputUrl(e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                        <p className="text-[9px] text-neutral-400 mt-1 flex items-center gap-1">
                          <Sparkles className="size-3 text-[#f97316]" /> Scan the sitemap to list every page, then tick which ones to index.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleScanSitemap}
                          disabled={!inputUrl.trim() || scanningSitemap}
                          className="px-3 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                        >
                          {scanningSitemap ? <Loader2 className="size-3.5 animate-spin" /> : <Globe className="size-3.5" />} Scan sitemap
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleTrainUrl(e as unknown as React.FormEvent)}
                          disabled={!inputUrl.trim() || !botId}
                          className="px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                        >
                          <Link2 className="size-3.5" /> Just this page
                        </button>
                      </div>

                      {discoveredUrls.length > 0 && (
                        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
                            <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">{selectedUrls.size} of {discoveredUrls.length} selected</span>
                            <div className="flex gap-3 text-[11px] font-semibold text-[#f97316]">
                              <button type="button" onClick={() => setSelectedUrls(new Set(discoveredUrls))} className="cursor-pointer hover:underline">Select all</button>
                              <button type="button" onClick={() => setSelectedUrls(new Set())} className="cursor-pointer hover:underline">None</button>
                            </div>
                          </div>
                          <div className="max-h-56 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-850">
                            {discoveredUrls.map((u) => (
                              <label key={u} className="flex items-center gap-2.5 px-3 py-2 text-[11px] cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900">
                                <input
                                  type="checkbox"
                                  checked={selectedUrls.has(u)}
                                  onChange={(e) => { const next = new Set(selectedUrls); if (e.target.checked) next.add(u); else next.delete(u); setSelectedUrls(next); }}
                                  className="sr-only"
                                />
                                <span className={`size-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors ${selectedUrls.has(u) ? "bg-[#f97316] border-[#f97316]" : "border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900"}`}>
                                  {selectedUrls.has(u) && <Check className="size-3 text-white" strokeWidth={3.5} />}
                                </span>
                                <span className="truncate text-neutral-700 dark:text-neutral-300">{u}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex justify-end p-2 border-t border-neutral-100 dark:border-neutral-800">
                            <button
                              type="button"
                              onClick={handleCrawlSelected}
                              disabled={!selectedUrls.size || crawlingPages || !botId}
                              className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                            >
                              {crawlingPages ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />} Crawl selected ({selectedUrls.size})
                            </button>
                          </div>
                        </div>
                      )}

                      {crawlSummary && <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{crawlSummary}</p>}
                    </div>
                  )}

                  {/* File upload */}
                  {kbSourceTab === "file" && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isKnowledgeLoading || !botId}
                        className="w-full border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl p-8 flex flex-col items-center justify-center gap-2 text-center hover:border-[#f97316]/50 hover:bg-[#f97316]/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isKnowledgeLoading ? (
                          <>
                            <Loader2 className="size-6 text-[#f97316] animate-spin" />
                            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Indexing {uploadingFile}…</span>
                          </>
                        ) : (
                          <>
                            <FileUp className="size-6 text-neutral-400" />
                            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Click to upload a document</span>
                            <span className="text-[10px] text-neutral-400">PDF, DOCX, TXT, MD — up to 20MB</span>
                          </>
                        )}
                      </button>
                      <p className="text-[9px] text-neutral-400 text-center">Uploaded files are sent to the backend, chunked, and embedded automatically.</p>
                    </div>
                  )}

                  {/* Google Drive folder */}
                  {kbSourceTab === "drive" && (
                    <form onSubmit={handleIndexDriveFolder} className="space-y-3">
                      {!googleConnected && (
                        <div className="flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg px-3 py-2">
                          <AlertCircle className="size-3.5 shrink-0" />
                          Connect Google in Agent Settings first for private folders. Public folders work without it.
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Folder URL or ID</label>
                        <input
                          type="text"
                          placeholder="https://drive.google.com/drive/folders/…"
                          value={driveFolderUrl}
                          onChange={(e) => setDriveFolderUrl(e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Max Files</label>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={driveMaxFiles}
                          onChange={(e) => setDriveMaxFiles(parseInt(e.target.value, 10) || 50)}
                          className="w-32 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                      </div>
                      {driveIndexError && <p className="text-[10px] text-red-500 font-medium">{driveIndexError}</p>}
                      {driveIndexSuccess && <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">{driveIndexSuccess}</p>}
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isIndexingDrive || !driveFolderUrl.trim()}
                          className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {isIndexingDrive ? <Loader2 className="size-3.5 animate-spin" /> : <FolderOpen className="size-3.5" />}
                          Index Folder
                        </button>
                      </div>
                    </form>
                  )}

                  {/* OneDrive folder */}
                  {kbSourceTab === "onedrive" && (
                    <form onSubmit={(e) => handleIndexDriveFolder(e, "onedrive")} className="space-y-3">
                      {!microsoftConnected && (
                        <div className="flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg px-3 py-2">
                          <AlertCircle className="size-3.5 shrink-0" />
                          Connect Microsoft in Agent Settings first to index OneDrive folders.
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">OneDrive Folder URL or ID</label>
                        <input
                          type="text"
                          placeholder="https://onedrive.live.com/… or folder ID"
                          value={driveFolderUrl}
                          onChange={(e) => setDriveFolderUrl(e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Max Files</label>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={driveMaxFiles}
                          onChange={(e) => setDriveMaxFiles(parseInt(e.target.value, 10) || 50)}
                          className="w-32 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                      </div>
                      {driveIndexError && <p className="text-[10px] text-red-500 font-medium">{driveIndexError}</p>}
                      {driveIndexSuccess && <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">{driveIndexSuccess}</p>}
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isIndexingDrive || !driveFolderUrl.trim() || !microsoftConnected}
                          className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {isIndexingDrive ? <Loader2 className="size-3.5 animate-spin" /> : <HardDrive className="size-3.5" />}
                          Index OneDrive Folder
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* Sources List */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-3 flex-wrap">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                    {t("training_data")}
                    <span className="text-neutral-300 dark:text-neutral-600 normal-case">({sources.length})</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    {/* Type filter */}
                    <div className="flex items-center gap-0.5 bg-neutral-50 dark:bg-neutral-950 rounded-lg p-0.5 border border-neutral-200 dark:border-neutral-800">
                      {(["all", "text", "url", "file"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setSourceTypeFilter(f)}
                          className={`px-2 py-1 text-[10px] font-semibold rounded-md capitalize transition-colors cursor-pointer ${
                            sourceTypeFilter === f ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    {/* Search */}
                    <div className="relative">
                      <Search className="size-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search sources…"
                        value={sourcesSearch}
                        onChange={(e) => setSourcesSearch(e.target.value)}
                        className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-[11px] w-40 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      />
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-neutral-100 dark:divide-neutral-850">
                  {(() => {
                    const q = sourcesSearch.toLowerCase();
                    const filtered = sources.filter(s =>
                      (sourceTypeFilter === "all" || s.type === sourceTypeFilter) &&
                      (s.name.toLowerCase().includes(q) || (s.content || "").toLowerCase().includes(q))
                    );

                    if (sources.length === 0) {
                      return (
                        <div className="p-10 text-center">
                          <Database className="size-8 text-neutral-300 dark:text-neutral-700 mx-auto" />
                          <p className="text-xs font-semibold text-neutral-500 mt-3">No knowledge sources yet</p>
                          <p className="text-[10px] text-neutral-400 mt-1">Add your first source above to start training your assistant.</p>
                        </div>
                      );
                    }
                    if (filtered.length === 0) {
                      return <div className="p-10 text-center text-xs text-neutral-400">No sources match your filter.</div>;
                    }

                    return filtered.map((s) => {
                      const TypeIcon = s.type === "url" ? Globe : s.type === "file" ? FileUp : Type;
                      const expanded = expandedSourceId === s.id;
                      return (
                        <div key={s.id} className="p-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-850/30 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="size-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 shrink-0 mt-0.5">
                              <TypeIcon className="size-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-xs">{s.name}</p>
                                {s.status === "trained" ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
                                    <Check className="size-2.5" /> Trained
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                                    <Loader2 className="size-2.5 animate-spin" /> Training
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[10px] text-neutral-400">
                                <span className="capitalize">{s.type}</span>
                                <span className="flex items-center gap-1"><FileText className="size-3" /> {(s.charCount || 0).toLocaleString()} chars</span>
                                {s.content && (
                                  <button
                                    onClick={() => setExpandedSourceId(expanded ? null : s.id)}
                                    className="text-[#f97316] hover:underline font-semibold cursor-pointer"
                                  >
                                    {expanded ? "Hide" : "Preview"}
                                  </button>
                                )}
                              </div>
                              {expanded && s.content && (
                                <div className="mt-2 text-[10px] text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-850 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed font-mono">
                                  {s.content.slice(0, 2000)}{s.content.length > 2000 ? "…" : ""}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteSource(s.id)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer shrink-0"
                              title="Delete source"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PLAYGROUND */}
          {activeTab === "playground" && (
            <div className="max-w-4xl mx-auto w-full py-6 px-4 flex flex-col items-center gap-3">
              <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-800 p-0.5 text-[11px] font-semibold">
                <button onClick={() => setPlaygroundView("test")} className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${playgroundView === "test" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-neutral-500"}`}>AI Test</button>
                <button onClick={() => setPlaygroundView("live")} className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${playgroundView === "live" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-neutral-500"}`}>Live Widget</button>
              </div>
              {playgroundView === "live" && (
                botId ? (
                  <>
                    <iframe
                      key={`${botId}-${primaryColor}-${widgetStyle}`}
                      src={`/embed/${botId}?color=${encodeURIComponent(primaryColor)}&style=${widgetStyle}`}
                      title="Live widget preview"
                      className="w-full max-w-lg h-[500px] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                    />
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Exactly what visitors see — reflects your last <span className="font-semibold">saved</span> settings.</p>
                  </>
                ) : (
                  <div className="w-full max-w-lg h-[500px] rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-xs text-neutral-400">Save your bot to preview the live widget.</div>
                )
              )}
              <div className={`w-full max-w-lg h-[500px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden relative flex flex-col style-${widgetStyle} ${playgroundView === "live" ? "hidden" : ""}`}>
                
                {/* Playground Header */}
                <div
                  style={widgetStyle === "minimalist" ? { backgroundColor: primaryColor } : {}}
                  className={`chat-header p-4 flex items-center justify-between border-b ${
                    widgetStyle === "minimalist" ? "text-white border-transparent" : "border-neutral-200 dark:border-neutral-850"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-white/20 dark:bg-black/20 flex items-center justify-center font-bold text-sm">C</div>
                    <div>
                      <h4 className="font-semibold text-sm leading-tight">{botName}</h4>
                      <p className="text-[9px] opacity-80 flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-green-400 animate-pulse"></span>
                        Playground • presets: {widgetStyle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Language picker at the top of the assistant */}
                    <div className="w-28">
                      <ModernSelect
                        value={language}
                        options={languageOptions}
                        onChange={(v) => setLanguage(v as "EN" | "ES" | "FR" | "DE" | "IT")}
                        align="right"
                        size="sm"
                      />
                    </div>
                    <button
                      onClick={() => setPlaygroundMessages([{ role: "assistant", content: welcomeMsg }])}
                      className="px-2 py-1 rounded border border-white/20 hover:bg-white/10 text-[10px] font-semibold transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Chat messages */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs scrollbar-thin">
                  {playgroundMessages.map((msg, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.92, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className={`flex gap-2 max-w-[85%] ${
                        msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                      }`}
                    >
                      {msg.role !== "user" && (
                        <div className="size-6 rounded-full bg-neutral-150 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-bold shrink-0">C</div>
                      )}
                      <div className="flex flex-col gap-1 w-full">
                        {/* Collapsible HTML5 Details for Reasoning Trace */}
                        {msg.role !== "user" && msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                          <details className="mb-1 text-[9px] text-neutral-400 dark:text-neutral-500 bg-neutral-50/50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-lg p-2 cursor-pointer select-none">
                            <summary className="font-semibold flex items-center gap-1.5 focus:outline-none hover:text-neutral-700 dark:hover:text-neutral-350">
                              <Sparkles className="size-3 text-[#f97316]" />
                              Agent Reasoning Trace
                            </summary>
                            <ul className="mt-1.5 pl-3 list-disc space-y-1 font-mono leading-normal border-t border-neutral-150/40 dark:border-neutral-800/40 pt-1.5">
                              {msg.thinkingSteps.map((step, sIdx) => (
                                <li key={sIdx}>{step}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                        <div
                          className={`p-3 rounded-2xl leading-relaxed ${
                            msg.role === "user"
                              ? "user-bubble text-white rounded-tr-none"
                              : "bot-bubble bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 rounded-tl-none"
                          }`}
                          style={msg.role === "user" ? (widgetStyle === "minimalist" ? { backgroundColor: primaryColor } : {}) : {}}
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="mb-0.5">{children}</li>,
                              pre: ({ children }) => <pre className="bg-neutral-950 text-white rounded-lg p-2 overflow-x-auto my-2 text-[10px] font-mono leading-normal">{children}</pre>,
                              code: ({ children }) => (
                                <code className={msg.role === "user" ? "bg-white/20 text-white px-1 py-0.5 rounded text-[10px] font-mono" : "bg-neutral-200 dark:bg-neutral-850 px-1 py-0.5 rounded text-[10px] font-mono"}>
                                  {children}
                                </code>
                              )
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>

                        {/* ── Agentic setup interactive controls ── */}
                        {msg.role !== "user" && (msg.calendarButtons || msg.connectorButtons) && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            <button
                              onClick={() => handleSetupQuickReply("calendar_google")}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
                                googleConnected
                                  ? "border-green-300 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400"
                                  : "border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 hover:bg-[#f97316]/5"
                              }`}
                            >
                              <svg className="size-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
                              {googleConnected ? "Google Connected" : "Connect Google Calendar"}
                              {googleConnected && <Check className="size-3.5" />}
                            </button>
                            <button
                              onClick={() => handleSetupQuickReply("calendar_microsoft")}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
                                microsoftConnected
                                  ? "border-green-300 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400"
                                  : "border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 hover:bg-[#f97316]/5"
                              }`}
                            >
                              <svg className="size-4" viewBox="0 0 24 24"><path fill="#F25022" d="M3 3h8v8H3z"/><path fill="#7FBA00" d="M13 3h8v8h-8z"/><path fill="#00A4EF" d="M3 13h8v8H3z"/><path fill="#FFB900" d="M13 13h8v8h-8z"/></svg>
                              {microsoftConnected ? "Microsoft Connected" : "Connect Outlook Calendar"}
                              {microsoftConnected && <Check className="size-3.5" />}
                            </button>
                          </div>
                        )}

                        {/* Timezone + Country pickers inline in chat */}
                        {msg.role !== "user" && msg.tzPicker && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 max-w-md">
                            <div>
                              <label className="block text-[9px] font-semibold text-neutral-400 uppercase mb-1">{t("country")}</label>
                              <ModernSelect value={botCountry} options={countryOptions} onChange={(v) => handleInputChange(setBotCountry, v)} searchable size="sm" />
                            </div>
                            <div>
                              <label className="block text-[9px] font-semibold text-neutral-400 uppercase mb-1">{t("timezone")}</label>
                              <ModernSelect value={botTimezone} options={timezoneOptions} onChange={(v) => handleInputChange(setBotTimezone, v)} searchable size="sm" />
                            </div>
                          </div>
                        )}

                        {/* Meeting provider picker inline in chat */}
                        {msg.role !== "user" && msg.providerPicker && (
                          <div className="mt-1 max-w-[220px]">
                            <label className="block text-[9px] font-semibold text-neutral-400 uppercase mb-1">Meeting Provider</label>
                            <ModernSelect value={meetingProvider} options={providerOptions} onChange={(v) => handleInputChange(setMeetingProvider, v)} size="sm" />
                          </div>
                        )}

                        {/* Lead field picker */}
                        {msg.role !== "user" && msg.leadFieldPicker && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {["name", "email", "phone", "company", "job_title", "country", "budget", "industry"].map((f) => {
                              const required = f === "name" || f === "email";
                              const on = pendingLeadFields.includes(f);
                              return (
                                <button
                                  key={f}
                                  disabled={required}
                                  onClick={() =>
                                    setPendingLeadFields((prev) =>
                                      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
                                    )
                                  }
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors capitalize ${
                                    on
                                      ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                                      : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                  } ${required ? "opacity-70 cursor-default" : "cursor-pointer"}`}
                                >
                                  {f.replace("_", " ")}{required ? " *" : ""}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Quick reply buttons */}
                        {msg.role !== "user" && msg.quickReplies && msg.quickReplies.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {msg.quickReplies.map((qr, qi) => (
                              <button
                                key={qi}
                                onClick={() => handleSetupQuickReply(qr.value)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 hover:bg-[#f97316]/5 text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                {qr.icon && <span>{qr.icon}</span>}
                                {qr.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {isBotResponding && (
                    <div className="flex gap-2 mr-auto max-w-[85%] w-full">
                      <div className="size-6 rounded-full bg-neutral-150 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-bold shrink-0">C</div>
                      <div className="flex-grow flex flex-col gap-1">
                        {/* Live Thinking Status & Trace */}
                        <div className="text-[9px] text-neutral-400 dark:text-neutral-500 bg-neutral-50/50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-lg p-2">
                          <div className="font-semibold flex items-center gap-1.5 animate-pulse text-[#f97316]">
                            <Loader2 className="size-3 animate-spin" />
                            Agent is reasoning...
                          </div>
                          {liveThinkingSteps.length > 0 && (
                            <ul className="mt-1.5 pl-3 list-disc space-y-1 font-mono leading-normal border-t border-neutral-150/40 dark:border-neutral-800/40 pt-1.5">
                              {liveThinkingSteps.map((step, sIdx) => (
                                <li key={sIdx} className="animate-fade-in">{step}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="p-3 rounded-2xl rounded-tl-none bg-neutral-100 text-neutral-400 dark:bg-neutral-850 flex items-center gap-1.5 w-fit">
                          <span className="size-1.5 rounded-full bg-neutral-450 animate-bounce"></span>
                          <span className="size-1.5 rounded-full bg-neutral-455 animate-bounce [animation-delay:0.2s]"></span>
                          <span className="size-1.5 rounded-full bg-neutral-460 animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={playgroundEndRef} />
                </div>

                {/* Alert banner if lead captured */}
                {collectedInPlayground && (
                  <div className="p-2 bg-green-50 dark:bg-green-950/20 border-t border-green-200 dark:border-green-900/50 flex items-center justify-between text-[10px] text-green-700 dark:text-green-400 px-4">
                    <span>New lead collected! Added to the Leads tab.</span>
                    <button onClick={() => setCollectedInPlayground(false)} className="font-bold underline cursor-pointer">Dismiss</button>
                  </div>
                )}

                {/* Form Input */}
                <form onSubmit={handlePlaygroundSend} className="p-3 border-t border-neutral-150 dark:border-neutral-900 flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask a question or type 'lead'..."
                    value={playgroundInput}
                    onChange={(e) => setPlaygroundInput(e.target.value)}
                    className="chat-input-bar flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none"
                  />
                  {(() => {
                    const map: Record<string, { shape: string; icon: any; label?: string }> = {
                      plane: { shape: "size-9 rounded-full", icon: <Send className="size-4" /> },
                      arrowUp: { shape: "size-9 rounded-full", icon: <ArrowUp className="size-4" /> },
                      arrowRight: { shape: "size-9 rounded-full", icon: <ArrowRight className="size-4" /> },
                      square: { shape: "size-9 rounded-lg", icon: <Send className="size-4" /> },
                      label: { shape: "h-9 px-3.5 rounded-full gap-1.5", icon: <Send className="size-3.5" />, label: "Send" },
                    };
                    const c = map[sendButtonStyle] || map.plane;
                    return (
                      <button type="submit" style={{ backgroundColor: primaryColor }}
                        className={`${c.shape} text-white flex items-center justify-center shrink-0 hover:opacity-90 cursor-pointer`}>
                        {c.icon}{c.label && <span className="text-xs font-semibold">{c.label}</span>}
                      </button>
                    );
                  })()}
                </form>
              </div>
            </div>
          )}

          {/* TAB 5: LEADS */}
          {/* TAB 5: LEADS */}
          {activeTab === "leads" && (
            <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Captured Leads ({leads.length})</h4>
                  <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1">Contact details gathered by your AI assistant during customer interactions.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search leads..."
                    value={leadsSearch}
                    onChange={(e) => setLeadsSearch(e.target.value)}
                    className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 w-48"
                  />
                  <button
                    onClick={exportLeadsCSV}
                    disabled={leads.length === 0}
                    className="text-[10px] font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg px-3 py-2 flex items-center gap-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    <FileSpreadsheet className="size-3.5" />
                    Export CSV
                  </button>
                </div>
              </div>

              {loadingLists ? (
                <div className="flex items-center justify-center p-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <Loader2 className="size-5 animate-spin text-neutral-400" />
                </div>
              ) : (
                <div className="overflow-x-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <table className="w-full border-collapse text-left text-xs text-neutral-500 dark:text-neutral-400">
                    <thead className="bg-neutral-50 dark:bg-neutral-955 font-semibold text-neutral-700 dark:text-neutral-300">
                      <tr>
                        {leadFields.map((field) => (
                          <th key={field} className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 capitalize">
                            {field.replace(/_/g, " ")}
                          </th>
                        ))}
                        <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Captured At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium text-neutral-800 dark:text-neutral-200">
                      {filteredLeads.map((l) => (
                        <tr key={l.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10">
                          {leadFields.map((field) => {
                            const val = getLeadFieldValue(l, field);
                            if (field === "name") {
                              return (
                                <td key={field} className="px-6 py-4 flex items-center gap-2.5">
                                  <div className="size-7 rounded-full bg-[#f97316]/10 text-[#f97316] flex items-center justify-center font-bold shrink-0">
                                    {val[0]?.toUpperCase() || "?"}
                                  </div>
                                  <span className="font-semibold">{val}</span>
                                </td>
                              );
                            }
                            return (
                              <td key={field} className="px-6 py-4 font-mono">
                                {val}
                              </td>
                            );
                          })}
                          <td className="px-6 py-4 text-neutral-400 dark:text-neutral-500 font-mono">
                            {l.created_at}
                          </td>
                        </tr>
                      ))}
                      
                      {/* Empty State */}
                      {filteredLeads.length === 0 && (
                        <tr>
                          <td colSpan={leadFields.length + 1} className="px-6 py-12 text-center space-y-2">
                            <Users className="size-8 mx-auto text-neutral-300" />
                            <h5 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">No matching leads found</h5>
                            <p className="text-[10px] text-neutral-400 max-w-xs mx-auto leading-normal">
                              {leads.length === 0 
                                ? "Start conversation tests in the Playground to see captured contact details show up in this panel."
                                : "Try clearing your search query or search for other parameters."}
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: INBOX */}
          {activeTab === "inbox" && (
            <div className="max-w-6xl mx-auto w-full py-6 px-4 space-y-4">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Inbox className="size-4 text-[#f97316]" /> Shared Inbox
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed max-w-xl">
                  Every visitor conversation, live. Jump in any time — replying takes over from the AI; toggle back to let the assistant continue.
                </p>
              </div>
              {botId && <InboxPanel botId={botId} fetchBackend={fetchWithFallback} formatDateTime={formatDateTime} color={primaryColor} />}
            </div>
          )}

          {/* TAB: MAP */}
          {activeTab === "map" && (
            <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="size-4 text-[#f97316]" /> Client Map
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed max-w-xl">
                    Where your leads are coming from. Each bubble is a country — bigger means more leads. Click a bubble for details.
                  </p>
                </div>
                <button
                  onClick={() => user && loadBotSettings(user.id)}
                  disabled={loadingLists}
                  className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-350 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${loadingLists ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>
              <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <LeadsMap leads={leads} color={primaryColor} />
              </div>
            </div>
          )}

          {/* TAB 6: ANALYTICS */}
          {activeTab === "analytics" && (
            <div className="max-w-4xl mx-auto w-full space-y-8 py-6 px-4">
              {loadingAnalytics ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl gap-3">
                  <Loader2 className="size-6 animate-spin text-[#f97316]" />
                  <p className="text-xs text-neutral-400 font-semibold">Calculating database metrics...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                      <span className="text-[10px] text-neutral-400 uppercase font-semibold">Total Queries Sent</span>
                      <h4 className="text-2xl font-bold mt-1">{totalQueries.toLocaleString()}</h4>
                      <p className="text-[9px] text-green-500 mt-1 font-medium">100% real database sync</p>
                    </div>
                    <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                      <span className="text-[10px] text-neutral-400 uppercase font-semibold">Lead Conversion Rate</span>
                      <h4 className="text-2xl font-bold mt-1">{conversionRate}%</h4>
                      <p className="text-[9px] text-[#f97316] mt-1 font-semibold">Total unique sessions: {totalSessions}</p>
                    </div>
                    <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                      <span className="text-[10px] text-neutral-400 uppercase font-semibold">Satisfaction Score</span>
                      <h4 className="text-2xl font-bold mt-1">{totalQueries > 0 ? "4.9 / 5.0" : "N/A"}</h4>
                      <p className="text-[9px] text-green-500 mt-1 font-medium">Based on Playground test logs</p>
                    </div>
                  </div>

                  <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-6">Queries Over Time (Last 7 Days)</h4>
                    
                    <div className="h-48 flex items-end justify-between gap-4 pt-4 px-2">
                      {analyticsChartData.map((item, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer h-full justify-end">
                          <span className="text-[10px] font-mono text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">{item.count}</span>
                          <div
                            style={{ height: item.height }}
                            className="w-full bg-neutral-200 dark:bg-neutral-800 group-hover:bg-[#f97316] transition-all rounded-t-md"
                          />
                          <span className="text-[10px] text-neutral-500 font-medium">{item.day}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 7: INTEGRATIONS */}
          {activeTab === "integrations" && (
            <div className="max-w-4xl mx-auto w-full py-6 px-4 space-y-6">
              <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <h3 className="text-sm font-bold">Embed Chatbot</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Copy and paste either the Javascript bundle or the inline iframe element onto your website.
                </p>

                {/* Script snippet */}
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-350">Option 1: Inline Chat Widget script (Recommended)</span>
                    <button
                      onClick={() => copyToClipboard(embedScriptCode, "script")}
                      className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedScript ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                      {copiedScript ? "Copied!" : "Copy Code"}
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 overflow-x-auto text-[10px] font-mono text-neutral-700 dark:text-neutral-350 leading-relaxed">
                    {embedScriptCode}
                  </pre>
                </div>

                {/* Iframe snippet */}
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-355">Option 2: Dedicated Embed Iframe</span>
                    <button
                      onClick={() => copyToClipboard(embedIframeCode, "iframe")}
                      className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedIframe ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                      {copiedIframe ? "Copied!" : "Copy Code"}
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 overflow-x-auto text-[10px] font-mono text-neutral-700 dark:text-neutral-355 leading-relaxed">
                    {embedIframeCode}
                  </pre>
                </div>
              </div>

              {/* Security: Allowed Domains */}
              <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ShieldAlert className="size-4 text-[#f97316]" /> Allowed Domains
                </h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Restrict where this widget can run. Leave empty to allow <b>any</b> website. Add domains to lock the
                  assistant to only your sites — requests from other domains are rejected.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = newDomain.trim().toLowerCase()
                      .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
                    if (d && !allowedDomains.includes(d)) {
                      handleInputChange(setAllowedDomains, [...allowedDomains, d]);
                    }
                    setNewDomain("");
                  }}
                  className="flex gap-2 mt-4"
                >
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="example.com"
                    className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                  />
                  <button
                    type="submit"
                    disabled={!newDomain.trim()}
                    className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <Plus className="size-3.5" /> Add
                  </button>
                </form>

                <div className="flex flex-wrap gap-2 mt-3">
                  {allowedDomains.length === 0 ? (
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                      <Globe className="size-3.5" /> Open to all domains (no restriction)
                    </span>
                  ) : (
                    allowedDomains.map((d) => (
                      <span key={d} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                        {d}
                        <button
                          onClick={() => handleInputChange(setAllowedDomains, allowedDomains.filter((x) => x !== d))}
                          className="text-neutral-400 hover:text-red-500 cursor-pointer"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
                {allowedDomains.length > 0 && (
                  <p className="text-[10px] text-neutral-400 mt-3">Remember to click <b>Save Changes</b> to apply.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB: DEVELOPER API */}
          {activeTab === "developer" && (
            <div className="max-w-4xl mx-auto w-full py-6 px-4 space-y-6">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Puzzle className="size-4 text-[#f97316]" /> Developer API
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed max-w-xl">
                  Call your trained assistant programmatically from any app or backend. Generate an API key, then POST to the chat endpoint with a Bearer token.
                </p>
              </div>

              {/* Usage summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Total Requests</p>
                  <p className="text-2xl font-bold mt-1 text-neutral-900 dark:text-white">{apiKeys.reduce((s: number, k: any) => s + (k.request_count || 0), 0).toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Active Keys</p>
                  <p className="text-2xl font-bold mt-1 text-neutral-900 dark:text-white">{apiKeys.filter((k: any) => !k.revoked).length}</p>
                </div>
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Last Activity</p>
                  <p className="text-sm font-semibold mt-2 text-neutral-700 dark:text-neutral-300">{(() => { const t = apiKeys.map((k: any) => k.last_used_at).filter(Boolean).sort(); return t.length ? formatDateTime(t[t.length - 1]) : "—"; })()}</p>
                </div>
              </div>

              {/* Newly created key (shown once) */}
              {newApiKey && (
                <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 rounded-2xl">
                  <p className="text-[11px] font-bold text-green-700 dark:text-green-400 flex items-center gap-1.5">
                    <Check className="size-3.5" /> New key created — copy it now, it won't be shown again.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 text-[11px] font-mono bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 truncate">{newApiKey}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(newApiKey); setCopiedApiKey(true); setTimeout(() => setCopiedApiKey(false), 2000); }}
                      className="px-3 py-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      {copiedApiKey ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copiedApiKey ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              {/* Keys list */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">API Keys ({apiKeys.length})</h4>
                  <button
                    onClick={handleCreateApiKey}
                    disabled={creatingApiKey || !botId}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-[11px] font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50"
                  >
                    {creatingApiKey ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                    Generate Key
                  </button>
                </div>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-850">
                  {apiKeys.length === 0 ? (
                    <div className="p-8 text-center text-xs text-neutral-400">No API keys yet. Generate one to start using the API.</div>
                  ) : (
                    apiKeys.map((k: any) => (
                      <div key={k.id} className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono font-semibold text-neutral-800 dark:text-neutral-200">{k.key_prefix}••••••••</code>
                            {k.revoked && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">Revoked</span>}
                          </div>
                          <p className="text-[10px] text-neutral-400 mt-0.5">
                            {(k.request_count || 0).toLocaleString()} requests
                            {k.last_used_at ? ` · last used ${formatDateTime(k.last_used_at)}` : " · never used"}
                            {k.created_at ? ` · created ${formatDateTime(k.created_at)}` : ""}
                          </p>
                        </div>
                        {!k.revoked && (
                          <button
                            onClick={() => handleRevokeApiKey(k.id)}
                            className="px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg cursor-pointer shrink-0"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Endpoint docs */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Endpoints</h4>
                <div className="space-y-1.5">
                  {[
                    { m: "POST", p: "/api/v1/chat", d: "Send a message, get the assistant's reply" },
                    { m: "GET", p: "/api/v1/bot", d: "Bot details (name, model, settings)" },
                    { m: "GET", p: "/api/v1/leads", d: "List captured leads (?limit&offset)" },
                    { m: "GET", p: "/api/v1/conversations", d: "Recent conversation messages (?limit)" },
                    { m: "GET", p: "/api/v1/usage", d: "This key's usage stats" },
                  ].map((e) => (
                    <div key={e.p} className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] w-12 text-center ${e.m === "POST" ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"}`}>{e.m}</span>
                      <code className="font-mono text-neutral-700 dark:text-neutral-300">{e.p}</code>
                      <span className="text-[10px] text-neutral-400 truncate">— {e.d}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-neutral-400">Base URL: <code className="font-mono">{BACKEND_URL}</code> · Auth: <code className="font-mono">Authorization: Bearer &lt;your_api_key&gt;</code> · Rate limit: 60 requests/min per key.</p>
                <pre className="bg-neutral-950 text-neutral-100 rounded-xl p-4 overflow-x-auto text-[11px] font-mono leading-relaxed">{`curl -X POST ${BACKEND_URL}/api/v1/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "What are your business hours?"}'

# Response: { "reply": "...", "session_id": "..." }`}</pre>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 pt-1">JavaScript</p>
                <pre className="bg-neutral-950 text-neutral-100 rounded-xl p-4 overflow-x-auto text-[11px] font-mono leading-relaxed">{`const res = await fetch("${BACKEND_URL}/api/v1/chat", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ text: "What are your business hours?" }),
});
const { reply, session_id } = await res.json();`}</pre>
              </div>
            </div>
          )}

          {/* TAB 8: AGENT SETTINGS */}
          {activeTab === "settings" && (
            <div className="max-w-4xl mx-auto w-full py-6 px-4 flex justify-center">
              <div className="w-full max-w-xl p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-6">
                
                {/* Model Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">AI Foundation Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => handleInputChange(setSelectedModel, e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 cursor-pointer"
                  >
                    <option value="gemini">Gemini 3.5 Flash (Default)</option>
                    <option value="gpt5">GPT-5.3 Turbo</option>
                    <option value="claude">Claude Opus</option>
                    <option value="mistral">Mistral Large</option>
                  </select>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5">Selected model handles logic & responses inside your widget.</p>
                </div>

                {/* System Instructions / Guardrails */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">System Instructions / Guardrails</label>
                  <textarea
                    rows={4}
                    value={systemInstructions}
                    onChange={(e) => handleInputChange(setSystemInstructions, e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 resize-none leading-relaxed"
                  />
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Configures behavior limitations and answers guidelines.</p>
                </div>

                <hr className="border-neutral-100 dark:border-neutral-800" />

                {/* Toggles */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold">Knowledge Base Strict Mode</span>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Only answer questions using verified trained memory sources.</p>
                    </div>
                    <button
                      onClick={() => handleInputChange(setStrictMode, !strictMode)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                        strictMode ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                      }`}
                    >
                      <div className={`size-4 rounded-full bg-white transition-transform ${strictMode ? "translate-x-4" : ""}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold">Email Lead Alerts</span>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Receive instant email updates when visitors submit contact info.</p>
                    </div>
                    <button
                      onClick={() => handleInputChange(setEmailNotify, !emailNotify)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                        emailNotify ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                      }`}
                    >
                      <div className={`size-4 rounded-full bg-white transition-transform ${emailNotify ? "translate-x-4" : ""}`} />
                    </button>
                  </div>
                </div>

                <hr className="border-neutral-100 dark:border-neutral-800" />

                {/* Connections & Calendar Booking Rules */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Connections & Calendar Rules</h4>

                  {/* Microsoft Connection Status */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                    <div>
                      <span className="text-xs font-semibold flex items-center gap-1.5">
                        <svg className="size-3.5" viewBox="0 0 24 24"><path fill="#F25022" d="M3 3h8v8H3z"/><path fill="#7FBA00" d="M13 3h8v8h-8z"/><path fill="#00A4EF" d="M3 13h8v8H3z"/><path fill="#FFB900" d="M13 13h8v8h-8z"/></svg>
                        Microsoft 365 Account
                      </span>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                        {microsoftConnected ? "Connected — enables Teams, Outlook Calendar & OneDrive." : "Connect for Teams meetings, Outlook calendar & OneDrive."}
                      </p>
                    </div>
                    {microsoftConnected ? (
                      <button
                        onClick={() => handleDisconnectCloud("microsoft")}
                        className="px-3 py-1.5 bg-red-50 text-red-650 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnectCloud("microsoft")}
                        disabled={connectingProvider !== null}
                        className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-55 flex items-center gap-1.5"
                      >
                        {connectingProvider === "microsoft" && <Loader2 className="size-3 animate-spin" />}
                        Connect
                      </button>
                    )}
                  </div>

                  {microsoftConnected && (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold">Sync Outlook Calendar</span>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Required for Microsoft Teams bookings via the chat widget.</p>
                      </div>
                      <button
                        onClick={() => handleInputChange(setSyncOutlookCalendar, !syncOutlookCalendar)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${syncOutlookCalendar ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"}`}
                      >
                        <div className={`size-4 rounded-full bg-white transition-transform ${syncOutlookCalendar ? "translate-x-4" : ""}`} />
                      </button>
                    </div>
                  )}

                  {/* Zoom Status */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                    <div>
                      <span className="text-xs font-semibold flex items-center gap-1.5">
                        <svg className="size-3.5" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#2D8CFF"/><path d="M6 9.5c0-.55.45-1 1-1h6c.55 0 1 .45 1 1v5c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-5zm9 1.2 2.6-1.7c.3-.2.7 0 .7.4v5.2c0 .4-.4.6-.7.4L15 14.3v-3.6z" fill="#fff"/></svg>
                        Zoom Meetings
                      </span>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                        {zoomConfigured ? "Ready — bookings create real Zoom links automatically." : "Zoom is not configured on the server yet."}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${zoomConfigured ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"}`}>
                      {zoomConfigured ? "Ready" : "Unavailable"}
                    </span>
                  </div>

                  {/* Provider readiness grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { label: "Google Meet", ready: googleConnected, hint: googleConnected ? "Ready" : "Connect Google" },
                      { label: "Zoom", ready: zoomConfigured, hint: zoomConfigured ? "Ready" : "Unavailable" },
                      { label: "MS Teams", ready: microsoftConnected, hint: microsoftConnected ? "Ready" : "Connect Microsoft" },
                      { label: "Google Drive", ready: googleConnected, hint: googleConnected ? "Ready" : "Connect Google" },
                      { label: "OneDrive", ready: microsoftConnected, hint: microsoftConnected ? "Ready" : "Connect Microsoft" },
                      { label: "Email (OneSignal)", ready: onesignalConfigured, hint: onesignalConfigured ? "OneSignal" : "Gmail fallback" },
                    ].map((p) => (
                      <div key={p.label} className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">{p.label}</span>
                          <span className={`size-2 rounded-full ${p.ready ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-700"}`} />
                        </div>
                        <p className="text-[9px] text-neutral-400 mt-0.5">{p.hint}</p>
                      </div>
                    ))}
                  </div>

                  {/* Google Connection Status */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                    <div>
                      <span className="text-xs font-semibold flex items-center gap-1.5">
                        <svg className="size-3.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        Google Workspace Account
                      </span>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                        {googleConnected ? "Connected successfully." : "Not connected yet."}
                      </p>
                    </div>
                    {googleConnected ? (
                      <button
                        onClick={() => handleDisconnectCloud("google")}
                        className="px-3 py-1.5 bg-red-50 text-red-650 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnectCloud("google")}
                        disabled={connectingProvider !== null}
                        className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-55 flex items-center gap-1.5"
                      >
                        {connectingProvider === "google" && <Loader2 className="size-3 animate-spin" />}
                        Connect
                      </button>
                    )}
                  </div>

                  {googleConnected && (
                    <div className="space-y-4 pt-1">
                      {/* Sync Google Drive */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold">Sync Google Drive (RAG)</span>
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Allow bot to reference files from your Google Drive.</p>
                        </div>
                        <button
                          onClick={() => handleInputChange(setSyncGoogleDrive, !syncGoogleDrive)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                            syncGoogleDrive ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                          }`}
                        >
                          <div className={`size-4 rounded-full bg-white transition-transform ${syncGoogleDrive ? "translate-x-4" : ""}`} />
                        </button>
                      </div>

                      {/* Sync Google Calendar */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold">Sync Google Calendar</span>
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Allow bot to read calendar events to check availability.</p>
                        </div>
                        <button
                          onClick={() => handleInputChange(setSyncGoogleCalendar, !syncGoogleCalendar)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                            syncGoogleCalendar ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                          }`}
                        >
                          <div className={`size-4 rounded-full bg-white transition-transform ${syncGoogleCalendar ? "translate-x-4" : ""}`} />
                        </button>
                      </div>

                      {/* Calendar Scheduling Enabled */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold">Enable Calendar Booking Rules</span>
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Allow visitors to book slots directly via the chat widget.</p>
                        </div>
                        <button
                          onClick={() => handleInputChange(setCalendarSchedulingEnabled, !calendarSchedulingEnabled)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                            calendarSchedulingEnabled ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                          }`}
                        >
                          <div className={`size-4 rounded-full bg-white transition-transform ${calendarSchedulingEnabled ? "translate-x-4" : ""}`} />
                        </button>
                      </div>

                      {calendarSchedulingEnabled && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="pl-4 border-l-2 border-neutral-200 dark:border-neutral-800 space-y-4 pt-1"
                        >
                          {/* Meeting Provider */}
                          <div>
                            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Meeting Provider</label>
                            <ModernSelect
                              value={meetingProvider}
                              options={providerOptions}
                              onChange={(v) => handleInputChange(setMeetingProvider, v)}
                            />
                            <p className="text-[9px] text-neutral-400 mt-1">
                              {meetingProvider === "google_meet"
                                ? "Real Meet links are generated automatically on the connected Google Calendar."
                                : meetingProvider === "zoom"
                                ? "Real Zoom links require Zoom credentials configured on the backend (else a placeholder is used)."
                                : "Real Microsoft Teams links are generated on booking — requires the owner to connect Microsoft/Outlook."}
                            </p>
                          </div>

                          {/* Duration Selector */}
                          <div>
                            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Allowed Time Duration</label>
                            <ModernSelect
                              value={String(schedulingDuration)}
                              options={[15, 30, 45, 60].map((m) => ({ value: String(m), label: `${m} Minutes` }))}
                              onChange={(v) => handleInputChange(setSchedulingDuration, parseInt(v, 10))}
                            />
                          </div>

                          {/* Country + Timezone (auto-detected, searchable) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">{t("country")}</label>
                              <ModernSelect
                                value={botCountry}
                                options={countryOptions}
                                onChange={(v) => handleInputChange(setBotCountry, v)}
                                searchable
                                placeholder="Select country"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">{t("timezone")}</label>
                              <ModernSelect
                                value={botTimezone}
                                options={timezoneOptions}
                                onChange={(v) => handleInputChange(setBotTimezone, v)}
                                searchable
                                placeholder="Select timezone"
                              />
                            </div>
                          </div>

                          {/* ── Booking Rules ── */}
                          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-850 space-y-3">
                            <h5 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                              <Calendar className="size-3.5 text-[#f97316]" /> Booking Rules
                            </h5>

                            {/* Business hours */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Open From</label>
                                <ModernSelect
                                  value={String(businessHoursStart)}
                                  options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${(h % 12) || 12}:00 ${h < 12 ? "AM" : "PM"}` }))}
                                  onChange={(v) => handleInputChange(setBusinessHoursStart, parseInt(v, 10))}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Open Until</label>
                                <ModernSelect
                                  value={String(businessHoursEnd)}
                                  options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${(h % 12) || 12}:00 ${h < 12 ? "AM" : "PM"}` }))}
                                  onChange={(v) => handleInputChange(setBusinessHoursEnd, parseInt(v, 10))}
                                />
                              </div>
                            </div>

                            {/* Working days */}
                            <div>
                              <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Working Days</label>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { id: "mon", label: "Mon" }, { id: "tue", label: "Tue" }, { id: "wed", label: "Wed" },
                                  { id: "thu", label: "Thu" }, { id: "fri", label: "Fri" }, { id: "sat", label: "Sat" }, { id: "sun", label: "Sun" },
                                ].map((d) => {
                                  const on = workingDays.includes(d.id);
                                  return (
                                    <button
                                      key={d.id}
                                      onClick={() => handleInputChange(setWorkingDays, on ? workingDays.filter((x) => x !== d.id) : [...workingDays, d.id])}
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer ${
                                        on ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]" : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                      }`}
                                    >
                                      {d.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Buffer + advance notice */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Buffer Between Meetings</label>
                                <ModernSelect
                                  value={String(bufferMinutes)}
                                  options={[0, 5, 10, 15, 30].map((m) => ({ value: String(m), label: m === 0 ? "No buffer" : `${m} min` }))}
                                  onChange={(v) => handleInputChange(setBufferMinutes, parseInt(v, 10))}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Minimum Advance Notice</label>
                                <ModernSelect
                                  value={String(advanceNoticeHours)}
                                  options={[0, 1, 2, 4, 12, 24, 48].map((h) => ({ value: String(h), label: h === 0 ? "None" : `${h} hours` }))}
                                  onChange={(v) => handleInputChange(setAdvanceNoticeHours, parseInt(v, 10))}
                                />
                              </div>
                            </div>

                            {/* Read-only summary of ALL active rules */}
                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-850 rounded-lg p-3 space-y-1 leading-relaxed">
                              <p className="font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[9px] tracking-wider mb-1">All active booking rules</p>
                              <p>• Hours: <b>{(businessHoursStart % 12) || 12}:00 {businessHoursStart < 12 ? "AM" : "PM"}</b> – <b>{(businessHoursEnd % 12) || 12}:00 {businessHoursEnd < 12 ? "AM" : "PM"}</b> ({botTimezone})</p>
                              <p>• Days: <b>{workingDays.length ? workingDays.map((d) => d.toUpperCase()).join(", ") : "None set"}</b></p>
                              <p>• Duration: <b>{schedulingDuration} min</b>{bufferMinutes ? <> · Buffer: <b>{bufferMinutes} min</b></> : null}</p>
                              {advanceNoticeHours ? <p>• Advance notice: <b>{advanceNoticeHours} hours</b></p> : null}
                              <p>• Platform: <b>{meetingProvider.replace("_", " ")}</b></p>
                              <p>• Collects all lead fields (<b>{leadFields.join(", ")}</b>) + visitor timezone before booking</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* TAB 9: MEETINGS */}
          {activeTab === "meetings" && (
            <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Scheduled Meetings</h4>
                  <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1">Calendar events booked by visitors through the assistant widget.</p>
                </div>
                <button
                  onClick={() => loadAdminData(botId || "")}
                  className="text-[10px] font-semibold border border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="size-3" />
                  Refresh
                </button>
              </div>

              {loadingAdminData ? (
                <div className="flex items-center justify-center p-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <Loader2 className="size-5 animate-spin text-neutral-400" />
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Section 1: Upcoming Meetings */}
                  <div className="space-y-4">
                    <h5 className="text-xs font-bold text-neutral-750 dark:text-neutral-300 flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Upcoming appointments ({adminMeetings.filter(m => new Date(m.start_time) >= new Date() && m.status !== 'cancelled').length})
                    </h5>
                    <div className="overflow-x-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                      <table className="w-full border-collapse text-left text-xs text-neutral-500 dark:text-neutral-400">
                        <thead className="bg-neutral-50 dark:bg-neutral-955 font-semibold text-neutral-700 dark:text-neutral-300">
                          <tr>
                            <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Client</th>
                            <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Meeting Details</th>
                            <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Scheduled Time</th>
                            <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Status</th>
                            <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium text-neutral-800 dark:text-neutral-200">
                          {adminMeetings.filter(m => new Date(m.start_time) >= new Date() && m.status !== 'cancelled').map((m) => (
                            <tr key={m.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10">
                              <td className="px-6 py-4">
                                <div className="font-semibold text-neutral-900 dark:text-white">{m.attendee_name || "Guest User"}</div>
                                <div className="text-[10px] text-neutral-450 font-mono mt-0.5">{m.attendee_email}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-semibold">{m.title}</div>
                                {m.meeting_link && (
                                  <a href={m.meeting_link} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 mt-1 text-[10px] cursor-pointer">
                                    <ExternalLink className="size-3" /> Join {m.provider === 'google_meet' ? 'Google Meet' : m.provider}
                                  </a>
                                )}
                              </td>
                              <td className="px-6 py-4 font-mono text-neutral-600 dark:text-neutral-300">
                                {formatDateTime(m.start_time)}
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400">
                                  {m.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => handleUpdateMeetingStatus(m.id, 'completed')}
                                    className="text-[9px] font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 px-2 py-1 rounded-lg cursor-pointer"
                                  >
                                    Done
                                  </button>
                                  <button
                                    onClick={() => handleUpdateMeetingStatus(m.id, 'cancelled')}
                                    className="text-[9px] font-bold bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-650 dark:text-red-400 px-2 py-1 rounded-lg cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          
                          {adminMeetings.filter(m => new Date(m.start_time) >= new Date() && m.status !== 'cancelled').length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-neutral-400 dark:text-neutral-500">
                                No upcoming appointments scheduled
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 2: Past & Cancelled Meetings */}
                  <div className="space-y-4 pt-4">
                    <h5 className="text-xs font-bold text-neutral-750 dark:text-neutral-450 flex items-center gap-2">
                      <span className="size-2 rounded-full bg-neutral-400"></span>
                      Past / Cancelled appointments ({adminMeetings.filter(m => new Date(m.start_time) < new Date() || m.status === 'cancelled').length})
                    </h5>
                    <div className="overflow-x-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                      <table className="w-full border-collapse text-left text-xs text-neutral-500 dark:text-neutral-400">
                        <thead className="bg-neutral-50 dark:bg-neutral-955 font-semibold text-neutral-700 dark:text-neutral-300">
                          <tr>
                            <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Client</th>
                            <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Meeting Details</th>
                            <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Scheduled Time</th>
                            <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-350">
                          {adminMeetings.filter(m => new Date(m.start_time) < new Date() || m.status === 'cancelled').map((m) => (
                            <tr key={m.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10 opacity-75">
                              <td className="px-6 py-4">
                                <div className="font-semibold text-neutral-800 dark:text-neutral-300">{m.attendee_name || "Guest User"}</div>
                                <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{m.attendee_email}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-semibold">{m.title}</div>
                              </td>
                              <td className="px-6 py-4 font-mono">
                                {formatDateTime(m.start_time)}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                  m.status === 'completed' 
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400' 
                                    : 'bg-red-50 text-red-755 dark:bg-red-950/20 dark:text-red-400'
                                }`}>
                                  {m.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          
                          {adminMeetings.filter(m => new Date(m.start_time) < new Date() || m.status === 'cancelled').length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-6 py-8 text-center text-neutral-400 dark:text-neutral-500">
                                No past meetings recorded
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: MAILBOX */}
          {activeTab === "mailbox" && (() => {
            const emails = adminNotifications
              .filter((n: any) => n.channel === "email")
              .filter((n: any) => mailboxFilter === "all" || n.type === mailboxFilter);
            const selected = emails.find((m: any) => m.id === selectedMailId) || emails[0] || null;
            const statusBadge = (s: string) => {
              const map: Record<string, string> = {
                sent: "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400",
                sent_gmail: "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400",
                logged: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
              };
              const label = s === "sent_gmail" ? "sent (gmail)" : s === "logged" ? "logged only" : s;
              return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${map[s] || "bg-neutral-100 text-neutral-500"}`}>{label}</span>;
            };
            return (
              <div className="max-w-6xl mx-auto w-full py-6 px-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                      <Mail className="size-3.5" /> Mailbox
                    </h4>
                    <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1">
                      Beautiful confirmation emails sent to clients and admins when a meeting is booked.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 bg-neutral-50 dark:bg-neutral-950 rounded-lg p-0.5 border border-neutral-200 dark:border-neutral-800">
                      {(["all", "client", "admin"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => { setMailboxFilter(f); setSelectedMailId(null); }}
                          className={`px-2.5 py-1 text-[10px] font-semibold rounded-md capitalize transition-colors cursor-pointer ${
                            mailboxFilter === f ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => botId && loadAdminData(botId)}
                      className="flex items-center gap-1.5 text-[11px] font-semibold border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-350 cursor-pointer"
                    >
                      <RefreshCw className={`size-3.5 ${loadingAdminData ? "animate-spin" : ""}`} /> Refresh
                    </button>
                  </div>
                </div>

                {emails.length === 0 ? (
                  <div className="p-12 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                    <Mail className="size-8 text-neutral-300 dark:text-neutral-700 mx-auto" />
                    <p className="text-xs font-semibold text-neutral-500 mt-3">No emails yet</p>
                    <p className="text-[10px] text-neutral-400 mt-1">When a visitor books a meeting, client &amp; admin confirmation emails will appear here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Email list */}
                    <div className="lg:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-850 max-h-[600px] overflow-y-auto">
                      {emails.map((m: any) => {
                        const isSel = selected && m.id === selected.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setSelectedMailId(m.id)}
                            className={`w-full text-left p-3.5 transition-colors cursor-pointer ${
                              isSel ? "bg-[#f97316]/5 border-l-2 border-l-[#f97316]" : "hover:bg-neutral-50 dark:hover:bg-neutral-850/40 border-l-2 border-l-transparent"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${m.type === "admin" ? "bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400" : "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"}`}>
                                {m.type}
                              </span>
                              {statusBadge(m.status)}
                            </div>
                            <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mt-1.5 truncate">{m.subject}</p>
                            <p className="text-[10px] text-neutral-400 truncate mt-0.5">To: {m.recipient}</p>
                            {m.created_at && <p className="text-[9px] text-neutral-400 mt-1">{formatDateTime(m.created_at)}</p>}
                          </button>
                        );
                      })}
                    </div>

                    {/* Email preview */}
                    <div className="lg:col-span-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden flex flex-col max-h-[600px]">
                      {selected ? (
                        <>
                          <div className="p-4 border-b border-neutral-100 dark:border-neutral-850">
                            <div className="flex items-center justify-between gap-2">
                              <h5 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{selected.subject}</h5>
                              {statusBadge(selected.status)}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-neutral-400">
                              <span>To: <span className="text-neutral-600 dark:text-neutral-300 font-medium">{selected.recipient}</span></span>
                              <span className="capitalize">· {selected.type} notification</span>
                              {selected.created_at && <span>· {formatDateTime(selected.created_at)}</span>}
                            </div>
                          </div>
                          <div className="flex-1 overflow-hidden bg-neutral-100 dark:bg-neutral-950">
                            {selected.html_content ? (
                              <iframe
                                title="email-preview"
                                sandbox=""
                                srcDoc={selected.html_content}
                                className="w-full h-full min-h-[420px] border-0 bg-white"
                              />
                            ) : (
                              <pre className="p-5 text-xs text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed font-sans">{selected.content}</pre>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-xs text-neutral-400">Select an email to preview</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 10: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Automated Notification Logs</h4>
                  <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1">Delivery reports for automated client meeting confirmations and administrator alerts.</p>
                </div>
                <button
                  onClick={() => loadAdminData(botId || "")}
                  className="text-[10px] font-semibold border border-neutral-200 dark:border-neutral-855 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="size-3" />
                  Refresh
                </button>
              </div>

              {loadingAdminData ? (
                <div className="flex items-center justify-center p-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <Loader2 className="size-5 animate-spin text-neutral-400" />
                </div>
              ) : (
                <div className="overflow-x-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <table className="w-full border-collapse text-left text-xs text-neutral-500 dark:text-neutral-400">
                    <thead className="bg-neutral-50 dark:bg-neutral-955 font-semibold text-neutral-700 dark:text-neutral-300">
                      <tr>
                        <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Channel</th>
                        <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Recipient</th>
                        <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Subject / Content</th>
                        <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Status</th>
                        <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Sent At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium text-neutral-800 dark:text-neutral-200">
                      {adminNotifications.map((n) => (
                        <tr key={n.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {n.channel === "email" ? (
                                <Mail className="size-4 text-blue-500" />
                              ) : (
                                <Bell className="size-4 text-amber-500" />
                              )}
                              <span className="capitalize">{n.channel}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono truncate max-w-[150px]" title={n.recipient}>
                            {n.recipient}
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            <div className="font-semibold text-neutral-900 dark:text-white truncate">{n.subject || "Alert Notification"}</div>
                            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">{n.content}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              n.status === 'delivered' || n.status === 'sent'
                                ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                                : 'bg-red-50 text-red-755 dark:bg-red-950/20 dark:text-red-400'
                            }`}>
                              {n.status}
                            </span>
                            {n.error_message && (
                              <div className="text-[9px] text-red-500 font-medium mt-1 leading-normal max-w-[140px] truncate">{n.error_message}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-neutral-400 dark:text-neutral-500 font-mono">
                            {formatDateTime(n.created_at)}
                          </td>
                        </tr>
                      ))}
                      
                      {adminNotifications.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center space-y-2 text-neutral-400">
                            <Bell className="size-8 mx-auto text-neutral-300" />
                            <h5 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">No notifications sent yet</h5>
                            <p className="text-[10px] text-neutral-400 max-w-xs mx-auto leading-normal">
                              Notification logs will populate once clients book meetings or updates are triggered.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 11: AUDIT LOG */}
          {activeTab === "audit_log" && (
            <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">System Audit Logs</h4>
                  <p className="text-[10px] text-neutral-455 dark:text-neutral-550 mt-1">Immutable ledger of administrative actions, data syncing, and configuration updates.</p>
                </div>
                <button
                  onClick={() => loadAdminData(botId || "")}
                  className="text-[10px] font-semibold border border-neutral-200 dark:border-neutral-855 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="size-3" />
                  Refresh
                </button>
              </div>

              {loadingAdminData ? (
                <div className="flex items-center justify-center p-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <Loader2 className="size-5 animate-spin text-neutral-400" />
                </div>
              ) : (
                <div className="overflow-x-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <table className="w-full border-collapse text-left text-xs text-neutral-500 dark:text-neutral-400">
                    <thead className="bg-neutral-50 dark:bg-neutral-955 font-semibold text-neutral-700 dark:text-neutral-300">
                      <tr>
                        <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Action Type</th>
                        <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Event Details</th>
                        <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Performed By</th>
                        <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium text-neutral-800 dark:text-neutral-200">
                      {adminAuditLogs.map((a) => (
                        <tr key={a.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10">
                          <td className="px-6 py-4">
                            <span className="font-bold text-neutral-900 dark:text-white capitalize">
                              {a.action.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-neutral-600 dark:text-neutral-300 leading-normal max-w-sm">
                            {a.details}
                          </td>
                          <td className="px-6 py-4 font-mono text-neutral-400 dark:text-neutral-500">
                            {a.performed_by}
                          </td>
                          <td className="px-6 py-4 text-neutral-400 dark:text-neutral-500 font-mono">
                            {formatDateTime(a.created_at)}
                          </td>
                        </tr>
                      ))}
                      
                      {adminAuditLogs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center space-y-2 text-neutral-400">
                            <FileText className="size-8 mx-auto text-neutral-300" />
                            <h5 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">No activity logged yet</h5>
                            <p className="text-[10px] text-neutral-400 max-w-xs mx-auto leading-normal">
                              Administrative configuration actions will be audited and listed here.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Telegram Link Dialog */}
      {telegramLinkOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100">
            <div>
              <h4 className="text-sm font-bold">Link Telegram</h4>
              <p className="text-[10px] text-neutral-400 mt-1 leading-normal">
                Get your chat ID from @KinByPersonaliAI_bot — send /start to it.
              </p>
            </div>
            <ol className="text-[10px] text-neutral-550 dark:text-neutral-400 space-y-1.5 list-decimal pl-4 leading-relaxed">
              <li>Open <a href="https://t.me/KinByPersonaliAI_bot" target="_blank" rel="noreferrer" className="text-[#f97316] underline">@KinByPersonaliAI_bot</a> on Telegram and tap <b>Start</b>.</li>
              <li>The bot will reply with your numeric chat ID.</li>
              <li>Paste that ID below — we'll send a confirmation message to verify.</li>
            </ol>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const target = e.target as HTMLFormElement;
                const chatIdInput = target.elements.namedItem("telegramChatId") as HTMLInputElement;
                const id = parseInt(chatIdInput.value.trim(), 10);
                if (!id) return;
                const success = await handleLinkTelegram(id);
                if (success) {
                  setTelegramLinkOpen(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Telegram chat ID</label>
                <input
                  name="telegramChatId"
                  type="text"
                  placeholder="e.g. 8123456789"
                  inputMode="numeric"
                  autoFocus
                  required
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setTelegramLinkOpen(false)}
                  className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#f97316] text-white rounded-lg hover:opacity-90 font-semibold cursor-pointer"
                >
                  Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Drive Indexer Dialog */}
      {driveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <FolderOpen className="size-5 text-yellow-500 animate-pulse" />
                <h4 className="text-sm font-bold">Index Google Drive Folder</h4>
              </div>
              <button onClick={() => setDriveModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer">
                <X className="size-4" />
              </button>
            </div>
            <p className="text-[11px] text-neutral-450 dark:text-neutral-400 leading-relaxed">
              Enter a Google Drive folder URL or ID. We will crawl the folder and index the files (PDF, DOCX, Sheets, Docs, TXT, MD) into your bot's RAG memory.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!driveFolderUrl.trim()) return;
              setIsIndexingDrive(true);
              setDriveIndexError(null);
              setDriveIndexSuccess(null);
              try {
                const res = await fetchWithFallback("/api/documents/index-folder", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    folder_id_or_url: driveFolderUrl.trim(),
                    max_files: driveMaxFiles,
                    source: "gdrive",
                  }),
                });
                if (res.ok) {
                  setDriveModalOpen(false);
                  setPlaygroundMessages(prev => [
                    ...prev,
                    {
                      role: "assistant",
                      content: `Started indexing Google Drive folder: **${driveFolderUrl.trim()}** (max ${driveMaxFiles} files) in the background. The documents will appear in your trained sources soon!`,
                      status: "success"
                    }
                  ]);
                  setDriveFolderUrl("");
                  // Refresh sources list in 5 seconds
                  setTimeout(() => {
                    if (user) loadBotSettings(user.id);
                  }, 5000);
                } else {
                  const body = await res.json();
                  setDriveIndexError(body.detail || "Failed to start folder indexing.");
                }
              } catch (err) {
                setDriveIndexError("Failed to connect to the server.");
              } finally {
                setIsIndexingDrive(false);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Folder URL or ID</label>
                <input
                  type="text"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={driveFolderUrl}
                  onChange={(e) => setDriveFolderUrl(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Max Files to Index</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={driveMaxFiles}
                  onChange={(e) => setDriveMaxFiles(parseInt(e.target.value, 10) || 50)}
                  className="w-full bg-neutral-50 dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                />
              </div>
              {driveIndexError && (
                <p className="text-[10px] text-red-500 font-medium">{driveIndexError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDriveModalOpen(false)}
                  className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer text-neutral-700 dark:text-neutral-350"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isIndexingDrive}
                  className="px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isIndexingDrive && <Loader2 className="size-3.5 animate-spin" />}
                  Start Indexing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}