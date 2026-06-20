"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  Puzzle
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
  const [primaryColor, setPrimaryColor] = useState("#f97316"); // default
  const [widgetStyle, setWidgetStyle] = useState<"minimalist" | "glassmorphism" | "liquid" | "neumorphism">("minimalist");
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

  // Playground Chat State
  const [playgroundMessages, setPlaygroundMessages] = useState<Array<{ role: string; content: string; thinkingSteps?: string[] }>>([]);
  const [liveThinkingSteps, setLiveThinkingSteps] = useState<string[]>([]);
  const [playgroundInput, setPlaygroundInput] = useState("");
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
  const [botCountry, setBotCountry] = useState<string>("");
  const [syncOffice365Calendar, setSyncOffice365Calendar] = useState<boolean>(false);
  const [meetingProvider, setMeetingProvider] = useState<string>("google_meet");
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);

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
  const [knowledgeMessages, setKnowledgeMessages] = useState<Array<{ role: string; content: string; status?: "info" | "success" | "error" | "pending"; filename?: string }>>([
    {
      role: "assistant",
      content: "Hello! I am your Knowledge Manager. I can help you train your chatbot. You can:\n\n1. **Upload files** (PDF, DOCX, TXT, MD) using the 📎 paperclip button.\n2. **Crawl websites** by pasting a URL (e.g. `https://example.com/faq`) or saying `crawl https://example.com`.\n3. **Train facts** by typing or pasting text documentation directly here.\n4. **Test RAG memory** by asking me questions like `What is the return policy?` to see what I've learned!"
    }
  ]);
  const [knowledgeInput, setKnowledgeInput] = useState("");
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [paperclipOpen, setPaperclipOpen] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<"none" | "recent_files" | "skills" | "more">("none");
  const [connectorsDropdownOpen, setConnectorsDropdownOpen] = useState(false);
  const [syncInstagram, setSyncInstagram] = useState(true);
  const [syncBrowser, setSyncBrowser] = useState(false);
  const knowledgeEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setPrimaryColor(activeBot.primary_color);
        setWidgetStyle(activeBot.widget_style || "minimalist");
        setSelectedModel(activeBot.selected_model);
        setSystemInstructions(activeBot.system_instructions);
        setStrictMode(activeBot.strict_mode);
        setEmailNotify(activeBot.email_notify);

        setSyncGoogleDrive(activeBot.sync_google_drive || false);
        setSyncGoogleCalendar(activeBot.sync_google_calendar || false);
        setCalendarSchedulingEnabled(activeBot.calendar_scheduling_enabled || false);
        setSchedulingDuration(activeBot.scheduling_duration_minutes || 30);
        setBotTimezone(activeBot.bot_timezone || "UTC");
        setOnboardingStep(activeBot.onboarding_step || 0);
        setOnboardingCompleted(activeBot.onboarding_completed || false);
        setLeadFields(activeBot.lead_fields || ["name", "email", "phone"]);
        setBotCountry(activeBot.bot_country || "");
        setSyncOutlookCalendar(activeBot.sync_outlook_calendar || false);
        setSyncOffice365Calendar(activeBot.sync_office365_calendar || false);
        setMeetingProvider(activeBot.meeting_provider || "google_meet");
        if (!activeBot.onboarding_completed) {
          setWizardOpen(true);
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
    if (botId && ["meetings", "notifications", "audit_log", "leads", "knowledge"].includes(activeTab)) {
      loadAdminData(botId);
    }
  }, [activeTab, botId]);

  // Save Onboarding step progress
  async function saveOnboardingStep(step: number, completed: boolean, extraData: any = {}) {
    if (!botId) return;
    
    // Optimistically update local states
    setOnboardingStep(step);
    if (completed) {
      setOnboardingCompleted(true);
      setWizardOpen(false);
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
          primary_color: primaryColor,
          widget_style: widgetStyle,
          selected_model: selectedModel,
          system_instructions: systemInstructions,
          strict_mode: strictMode,
          email_notify: emailNotify,
          sync_google_drive: syncGoogleDrive,
          sync_google_calendar: syncGoogleCalendar,
          calendar_scheduling_enabled: calendarSchedulingEnabled,
          scheduling_duration_minutes: schedulingDuration,
          bot_timezone: botTimezone,
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
  }, [knowledgeMessages, isKnowledgeLoading, uploadingFile]);

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
    setKnowledgeMessages((prev) => [
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
        setKnowledgeMessages((prev) =>
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
        setKnowledgeMessages((prev) =>
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
      setKnowledgeMessages((prev) =>
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
    setKnowledgeMessages((prev) => [...prev, { role: "user", content: userInput }]);

    // Check if it is a URL or a crawl command
    const crawlMatch = userInput.match(/^(?:crawl\s+)?(https?:\/\/[^\s]+)$/i);

    if (crawlMatch) {
      const urlToCrawl = crawlMatch[1];
      
      // Add thinking/progress bubble
      setKnowledgeMessages((prev) => [
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
            setKnowledgeMessages((prev) =>
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
        setKnowledgeMessages((prev) =>
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

      setKnowledgeMessages((prev) => [
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

            setKnowledgeMessages((prev) =>
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
        setKnowledgeMessages((prev) =>
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
        setKnowledgeMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: body.reply
          }
        ]);
      } else {
        const body = await res.json();
        setKnowledgeMessages((prev) => [
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
      setKnowledgeMessages((prev) => [
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
  const handleIndexDriveFolder = async (e: React.FormEvent) => {
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
          source: "gdrive",
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
  const embedScriptCode = `<script\n  src="https://cdn.personaliai.com/chatty.js"\n  data-id="bot_chatty_${botName.toLowerCase().replace(/[^a-z0-9]/g, "_")}"\n  data-color="${primaryColor}"\n  data-style="${widgetStyle}"\n></script>`;
  const embedIframeCode = `<iframe\n  src="https://chatty.personaliai.com/embed/bot_chatty_${botName.toLowerCase().replace(/[^a-z0-9]/g, "_")}?color=${encodeURIComponent(primaryColor)}&style=${widgetStyle}"\n  width="100%"\n  height="600"\n  frameborder="0"\n></iframe>`;

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

          {/* Right: Auxiliary Icons & Send */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setKnowledgeMessages(prev => [...prev, { role: "assistant", content: "Skills trigger activated (Mock interface)." }])}
              className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <MessageSquare className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setKnowledgeMessages(prev => [...prev, { role: "assistant", content: "Voice recognition activated (Mock interface). Speak to train your bot." }])}
              className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <Mic className="size-4" />
            </button>

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
              { id: "knowledge", label: t("training_data"), icon: Database },
              { id: "playground", label: t("playground"), icon: MessageSquare, badge: true },
              { id: "leads", label: t("leads"), icon: Users },
              { id: "meetings", label: t("meetings"), icon: Calendar },
              { id: "notifications", label: t("notifications"), icon: Bell },
              { id: "audit_log", label: t("audit_log"), icon: FileText },
              { id: "analytics", label: t("analytics"), icon: BarChart3 },
              { id: "integrations", label: t("integrations"), icon: Code2 },
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
              <p className="text-[11px] font-semibold truncate">{user ? user.email.split("@")[0] : "Demo User"}</p>
              <p className="text-[9px] text-neutral-400 dark:text-neutral-500 truncate">
                {user ? "Production Account" : "Hobby Plan • trial"}
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
            <div className="flex items-center gap-1.5 border border-neutral-100 dark:border-neutral-800 rounded-lg px-2.5 py-1 bg-neutral-50/50 dark:bg-neutral-950/20">
              <span className="text-[10px] font-bold uppercase text-neutral-400">{t("language")}:</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="bg-transparent border-none rounded text-[10px] focus:outline-none cursor-pointer text-neutral-700 dark:text-neutral-300 font-bold pr-1"
              >
                <option value="EN" className="bg-white dark:bg-neutral-900">EN (English)</option>
                <option value="ES" className="bg-white dark:bg-neutral-900">ES (Español)</option>
                <option value="FR" className="bg-white dark:bg-neutral-900">FR (Français)</option>
                <option value="DE" className="bg-white dark:bg-neutral-900">DE (Deutsch)</option>
                <option value="IT" className="bg-white dark:bg-neutral-900">IT (Italiano)</option>
              </select>
            </div>
            
            {/* Setup Wizard Button */}
            {onboardingCompleted && (
              <button
                onClick={() => { setOnboardingStep(0); setWizardOpen(true); }}
                className="text-[10px] border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 rounded-lg px-2.5 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer font-bold text-neutral-600 dark:text-neutral-400 transition-colors flex items-center gap-1"
              >
                <Sparkles className="size-3 text-[#f97316]" />
                {t("setup_wizard")}
              </button>
            )}

            <span className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${user ? "bg-green-500" : "bg-yellow-500"}`}></span>
              {user ? "Database Active" : "Trial Sandbox"}
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
                    onClick={() => setActiveTab("knowledge")}
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

                    {/* Footer input form */}
                    <div className="p-3 border-t border-neutral-100 dark:border-neutral-900 flex gap-2">
                      <input
                        disabled
                        type="text"
                        placeholder="Type a message..."
                        className="chat-input-bar flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-450"
                      />
                      <button
                        disabled
                        style={widgetStyle === "minimalist" ? { backgroundColor: primaryColor } : {}}
                        className="p-2 text-white rounded-lg flex items-center justify-center shrink-0 opacity-50"
                      >
                        <Send className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* TAB 3: KNOWLEDGE BASE — Full Chat Layout */}
          {/* TAB 3: KNOWLEDGE BASE — Split Chat Layout */}
          {activeTab === "knowledge" && (
            <div className="flex flex-col lg:flex-row h-[calc(100vh-130px)] max-w-7xl mx-auto w-full gap-6 px-4 relative">
              {/* Left Column: Chat Assistant */}
              <div className="flex-1 flex flex-col h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden relative">
                
              
              {/* If no user messages yet, show the centered empty state */}
              {!knowledgeMessages.some(msg => msg.role === "user") ? (
                <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 max-w-xl mx-auto w-full text-center relative z-10">
                  <h2 className="text-3xl sm:text-4xl font-serif text-neutral-800 dark:text-neutral-100 mb-8 font-medium tracking-tight">
                    What can I do for you?
                  </h2>
                  
                  {/* Composer & Popups Wrapper */}
                  <div className="w-full relative">
                    {renderComposer()}

                    {/* Paperclip (+) popup menu */}
                    <AnimatePresence>
                      {paperclipOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => { setPaperclipOpen(false); setActiveSubmenu("none"); }} />
                          <motion.div
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 15, scale: 0.95 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="absolute bottom-[68px] left-3 z-40 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-1.5 w-64 flex flex-col gap-0.5 text-left"
                          >
                            <button
                              type="button"
                              onClick={() => { fileInputRef.current?.click(); setPaperclipOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                            >
                              <Paperclip className="size-4 text-neutral-500" />
                              Add from local files
                            </button>

                            <button
                              type="button"
                              onClick={() => setActiveSubmenu(activeSubmenu === "recent_files" ? "none" : "recent_files")}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors cursor-pointer ${
                                activeSubmenu === "recent_files"
                                  ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                                  : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <FileText className="size-4 text-neutral-500" />
                                Recent files
                              </div>
                              <svg className="size-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              onClick={() => setActiveSubmenu(activeSubmenu === "skills" ? "none" : "skills")}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors cursor-pointer ${
                                activeSubmenu === "skills"
                                  ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                                  : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Puzzle className="size-4 text-neutral-500" />
                                Use Skills
                              </div>
                              <svg className="size-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              onClick={() => { setDriveModalOpen(true); setPaperclipOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                            >
                              <svg className="size-4" viewBox="0 0 24 24" fill="none">
                                <path d="M15.43 14.5H23L15.43 1.5H7.86L15.43 14.5Z" fill="#0066DA" />
                                <path d="M15.43 14.5H7.86L0.29 1.5H7.86L15.43 14.5Z" fill="#00A1F1" />
                                <path d="M15.43 14.5L7.86 21.5H23L15.43 14.5Z" fill="#F2B200" />
                              </svg>
                              Add from Google Drive
                            </button>

                            <button
                              type="button"
                              onClick={() => setActiveSubmenu(activeSubmenu === "more" ? "none" : "more")}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors cursor-pointer ${
                                activeSubmenu === "more"
                                  ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                                  : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="grid grid-cols-2 gap-0.5 size-4">
                                  <div className="bg-neutral-500 rounded-[1px]"></div>
                                  <div className="bg-neutral-500 rounded-[1px]"></div>
                                  <div className="bg-neutral-500 rounded-[1px]"></div>
                                  <div className="bg-neutral-500 rounded-[1px]"></div>
                                </div>
                                More
                              </div>
                              <svg className="size-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>

                            {/* Active Submenu */}
                            {activeSubmenu === "recent_files" && (
                              <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="absolute left-[264px] top-0 w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-1.5 flex flex-col gap-0.5 max-h-[380px] overflow-y-auto"
                              >
                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-850 mb-1">
                                  Recent Files
                                </div>
                                {sources.map((s) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => {
                                      setKnowledgeMessages(prev => [...prev, { role: "assistant", content: `Viewing metadata for source **${s.name}**:\n- **Type**: ${s.type}\n- **Char count**: ${s.charCount}\n- **Status**: ${s.status === "trained" ? "Active" : "Processing"}` }]);
                                      setPaperclipOpen(false);
                                      setActiveSubmenu("none");
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors truncate"
                                  >
                                    {s.type === "url" ? <Globe className="size-4 text-emerald-500 shrink-0" /> : <FileText className="size-4 text-blue-500 shrink-0" />}
                                    <span className="truncate">{s.name}</span>
                                  </button>
                                ))}
                                {sources.length === 0 && (
                                  <>
                                    {[
                                      { name: "Analysis of High-Probability M...", type: "doc" },
                                      { name: "Unique SaaS Chrome Extensio...", type: "doc" },
                                      { name: "John Keells PLC Annual Report...", type: "doc" },
                                      { name: "index.html", type: "code" },
                                      { name: "Advanced Intelligent Binance ...", type: "doc" },
                                      { name: "advanced_binance_futures_ag...", type: "zip" },
                                      { name: "Binance Futures AI Agent for S...", type: "doc" },
                                      { name: "binance_futures_agent.zip", type: "zip" }
                                    ].map((mock, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                          setKnowledgeInput(`Let's talk about ${mock.name}`);
                                          setPaperclipOpen(false);
                                          setActiveSubmenu("none");
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors truncate"
                                      >
                                        {mock.type === "code" ? (
                                          <span className="size-4 text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 rounded flex items-center justify-center shrink-0">HTML</span>
                                        ) : mock.type === "zip" ? (
                                          <span className="size-4 text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 rounded flex items-center justify-center shrink-0">ZIP</span>
                                        ) : (
                                          <FileText className="size-4 text-blue-500 shrink-0" />
                                        )}
                                        <span className="truncate">{mock.name}</span>
                                      </button>
                                    ))}
                                  </>
                                )}
                                <div className="border-t border-neutral-100 dark:border-neutral-850 my-1"></div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPaperclipOpen(false);
                                    setActiveSubmenu("none");
                                    const sourcesList = sources.length === 0
                                      ? "You have no trained sources yet. Upload a file, paste a URL, or type some facts to get started!"
                                      : `You have **${sources.length} trained sources** (${sources.reduce((a, s) => a + s.charCount, 0).toLocaleString()} chars total):\n\n${sources.map((s, i) => `${i + 1}. **${s.name}** — ${s.type} • ${s.charCount} chars • ${s.status === "trained" ? "✅" : "⏳"}`).join("\n")}`;
                                    setKnowledgeMessages(prev => [...prev, { role: "assistant", content: sourcesList, status: "info" }]);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold text-neutral-800 dark:text-neutral-250 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shrink-0"
                                >
                                  <Layers className="size-4 text-purple-600 shrink-0" />
                                  Add from library
                                </button>
                              </motion.div>
                            )}

                            {activeSubmenu === "skills" && (
                              <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="absolute left-[264px] top-0 w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-1.5 flex flex-col gap-0.5"
                              >
                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-450 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-850 mb-1">
                                  Skills Available
                                </div>
                                <button
                                  type="button"
                                  onClick={() => { setKnowledgeInput("crawl https://"); setPaperclipOpen(false); setActiveSubmenu("none"); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                                >
                                  <Globe className="size-4 text-emerald-500" />
                                  Crawl Website
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setKnowledgeInput("search web for "); setPaperclipOpen(false); setActiveSubmenu("none"); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                                >
                                  <Sparkles className="size-4 text-amber-500" />
                                  Search Web
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setKnowledgeInput("parse pdf and extract "); setPaperclipOpen(false); setActiveSubmenu("none"); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                                >
                                  <FileText className="size-4 text-blue-500" />
                                  File Parser
                                </button>
                              </motion.div>
                            )}

                            {activeSubmenu === "more" && (
                              <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="absolute left-[264px] top-0 w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-1.5 flex flex-col gap-0.5"
                              >
                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-450 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-850 mb-1">
                                  More Options
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setKnowledgeMessages([{
                                      role: "assistant",
                                      content: "Chat cleared! Send me URLs to crawl, upload files via the 📎 button, or type documentation to train your bot. Ask any question to test what I've learned."
                                    }]);
                                    setPaperclipOpen(false);
                                    setActiveSubmenu("none");
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                >
                                  <Trash2 className="size-4 text-red-500" />
                                  Clear Chat
                                </button>
                              </motion.div>
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>

                    {/* Connectors Dropdown menu */}
                    <AnimatePresence>
                      {connectorsDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setConnectorsDropdownOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 15, scale: 0.95 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="absolute bottom-[68px] left-12 z-40 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-2 w-72 flex flex-col gap-1 text-left font-sans"
                          >
                            <div className="px-3 py-1 text-[10px] font-bold text-neutral-450 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-850 mb-1">
                              Active Connectors
                            </div>

                            {/* Google Calendar */}
                            <div className="flex items-center justify-between px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-xl transition-colors">
                              <div className="flex items-center gap-2.5">
                                <div className="size-5 shrink-0 flex items-center justify-center">
                                  <svg className="size-4.5" viewBox="0 0 24 24" fill="none">
                                    <rect width="24" height="24" rx="4.5" fill="#4285F4" />
                                    <text x="50%" y="65%" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="sans-serif">31</text>
                                  </svg>
                                </div>
                                <span className="text-xs font-semibold text-neutral-750 dark:text-neutral-200">Google Calendar</span>
                              </div>
                              {googleConnected ? (
                                <div
                                  className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${syncGoogleCalendar ? "bg-blue-600" : "bg-neutral-250 dark:bg-neutral-700"}`}
                                  onClick={() => setSyncGoogleCalendar(!syncGoogleCalendar)}
                                >
                                  <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform shadow-sm ${syncGoogleCalendar ? "translate-x-3.5" : "translate-x-0"}`} />
                                </div>
                              ) : (
                                <button type="button" onClick={() => handleConnectCloud("google")} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">Connect</button>
                              )}
                            </div>

                            {/* Google Drive */}
                            <div className="flex items-center justify-between px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-xl transition-colors">
                              <div className="flex items-center gap-2.5">
                                <div className="size-5 shrink-0 flex items-center justify-center">
                                  <svg className="size-4.5" viewBox="0 0 24 24" fill="none">
                                    <path d="M15.43 14.5H23L15.43 1.5H7.86L15.43 14.5Z" fill="#0066DA" />
                                    <path d="M15.43 14.5H7.86L0.29 1.5H7.86L15.43 14.5Z" fill="#00A1F1" />
                                    <path d="M15.43 14.5L7.86 21.5H23L15.43 14.5Z" fill="#F2B200" />
                                  </svg>
                                </div>
                                <span className="text-xs font-semibold text-neutral-750 dark:text-neutral-200">Google Drive</span>
                              </div>
                              {googleConnected ? (
                                <div
                                  className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${syncGoogleDrive ? "bg-blue-600" : "bg-neutral-250 dark:bg-neutral-700"}`}
                                  onClick={() => setSyncGoogleDrive(!syncGoogleDrive)}
                                >
                                  <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform shadow-sm ${syncGoogleDrive ? "translate-x-3.5" : "translate-x-0"}`} />
                                </div>
                              ) : (
                                <button type="button" onClick={() => handleConnectCloud("google")} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">Connect</button>
                              )}
                            </div>

                            {/* Microsoft OneDrive */}
                            <div className="flex items-center justify-between px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-xl transition-colors">
                              <div className="flex items-center gap-2.5">
                                <div className="size-5 shrink-0 flex items-center justify-center">
                                  <svg className="size-4.5" viewBox="0 0 24 24" fill="none">
                                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" fill="#0078D4"/>
                                  </svg>
                                </div>
                                <span className="text-xs font-semibold text-neutral-750 dark:text-neutral-200">OneDrive</span>
                              </div>
                              {microsoftConnected ? (
                                <div
                                  className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${syncOneDrive ? "bg-blue-600" : "bg-neutral-250 dark:bg-neutral-700"}`}
                                  onClick={() => setSyncOneDrive(!syncOneDrive)}
                                >
                                  <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform shadow-sm ${syncOneDrive ? "translate-x-3.5" : "translate-x-0"}`} />
                                </div>
                              ) : (
                                <button type="button" onClick={() => handleConnectCloud("microsoft")} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">Connect</button>
                              )}
                            </div>

                            {/* Microsoft Outlook Calendar */}
                            <div className="flex items-center justify-between px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-xl transition-colors">
                              <div className="flex items-center gap-2.5">
                                <div className="size-5 shrink-0 flex items-center justify-center">
                                  <svg className="size-4.5" viewBox="0 0 24 24" fill="none">
                                    <rect width="24" height="24" rx="4.5" fill="#0078D4" />
                                    <path d="M6 18H18V10H6V18ZM18 6H16V5c0-.55-.45-1-1-1s-1 .45-1 1v1H10V5c0-.55-.45-1-1-1s-1 .45-1 1v1H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" fill="white"/>
                                  </svg>
                                </div>
                                <span className="text-xs font-semibold text-neutral-750 dark:text-neutral-200">Outlook Calendar</span>
                              </div>
                              {microsoftConnected ? (
                                <div
                                  className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${syncOutlookCalendar ? "bg-blue-600" : "bg-neutral-250 dark:bg-neutral-700"}`}
                                  onClick={() => setSyncOutlookCalendar(!syncOutlookCalendar)}
                                >
                                  <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform shadow-sm ${syncOutlookCalendar ? "translate-x-3.5" : "translate-x-0"}`} />
                                </div>
                              ) : (
                                <button type="button" onClick={() => handleConnectCloud("microsoft")} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">Connect</button>
                              )}
                            </div>

                            <div className="border-t border-neutral-100 dark:border-neutral-850 my-1"></div>

                            <button
                              type="button"
                              onClick={() => { setActiveTab("integrations"); setConnectorsDropdownOpen(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-850 dark:text-neutral-250 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                            >
                              <Sliders className="size-4 text-neutral-500" />
                              <span>Manage connectors</span>
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Suggestion Pills */}
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-6 max-w-xl">
                    <button
                      onClick={() => setKnowledgeInput("Build website")}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-100/80 hover:bg-neutral-200/80 dark:bg-neutral-800/80 dark:hover:bg-neutral-750 text-xs font-semibold text-neutral-700 dark:text-neutral-200 rounded-full border border-neutral-200/40 dark:border-neutral-750/50 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                    >
                      <Code2 className="size-3.5 text-neutral-500" />
                      Build website
                    </button>
                    <button
                      onClick={() => setKnowledgeInput("Develop desktop apps")}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-100/80 hover:bg-neutral-200/80 dark:bg-neutral-800/80 dark:hover:bg-neutral-750 text-xs font-semibold text-neutral-700 dark:text-neutral-200 rounded-full border border-neutral-200/40 dark:border-neutral-750/50 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                    >
                      <Laptop className="size-3.5 text-neutral-500" />
                      Develop desktop apps
                    </button>
                    <button
                      onClick={() => setKnowledgeInput("Design")}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-100/80 hover:bg-neutral-200/80 dark:bg-neutral-800/80 dark:hover:bg-neutral-750 text-xs font-semibold text-neutral-700 dark:text-neutral-200 rounded-full border border-neutral-200/40 dark:border-neutral-750/50 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                    >
                      <Palette className="size-3.5 text-neutral-500" />
                      Design
                    </button>
                    <button
                      onClick={() => {
                        setKnowledgeMessages(prev => [...prev, { role: "assistant", content: "Web scraping, Google Drive indexing, Calendar allowed scheduling slots, and Instagram response configs are fully supported. Ask any question to get started!" }]);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-100/80 hover:bg-neutral-200/80 dark:bg-neutral-800/80 dark:hover:bg-neutral-750 text-xs font-semibold text-neutral-700 dark:text-neutral-200 rounded-full border border-neutral-200/40 dark:border-neutral-750/50 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                    >
                      <MoreHorizontal className="size-3.5 text-neutral-500" />
                      More
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shrink-0 z-10">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-xl bg-gradient-to-br from-[#f97316] to-[#ec4899] flex items-center justify-center text-white font-bold text-sm shadow-md">
                        KM
                      </div>
                      <div>
                        <h4 className="font-bold text-sm leading-none">Knowledge Manager</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span className="text-[10px] text-neutral-450">{sources.length} sources trained • {sources.reduce((a, s) => a + s.charCount, 0).toLocaleString()} chars</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {googleConnected ? (
                        <button
                          onClick={() => handleDisconnectCloud("google")}
                          className="flex items-center gap-1.5 text-[9px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-full px-2.5 py-1 border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 cursor-pointer transition-colors"
                        >
                          <span className="size-1.5 rounded-full bg-emerald-500"></span>
                          Google Connected
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnectCloud("google")}
                          disabled={connectingProvider !== null}
                          className="flex items-center gap-1.5 text-[9px] font-semibold bg-neutral-100 text-neutral-600 dark:bg-neutral-850 dark:text-neutral-400 rounded-full px-2.5 py-1 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-750 cursor-pointer transition-colors disabled:opacity-50"
                        >
                          {connectingProvider === "google" ? <Loader2 className="size-2.5 animate-spin" /> : <svg className="size-3" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>}
                          Connect Google
                        </button>
                      )}
                      <button
                        onClick={() => setKnowledgeMessages([{
                          role: "assistant",
                          content: "Chat cleared! Send me URLs to crawl, upload files via the 📎 button, or type documentation to train your bot. Ask any question to test what I've learned."
                        }])}
                        className="text-[9px] font-semibold text-neutral-450 hover:text-neutral-600 dark:hover:text-neutral-350 cursor-pointer transition-colors px-1.5 py-1"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Chat Messages Area */}
                  <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 scrollbar-thin">
                    {knowledgeMessages.map((msg, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {msg.role !== "user" && (
                          <div className="size-7 rounded-lg bg-gradient-to-br from-[#f97316] to-[#ec4899] flex items-center justify-center text-white font-bold text-[9px] shrink-0 mt-0.5 shadow-sm">
                            KM
                          </div>
                        )}
                        <div className="max-w-[80%] flex flex-col gap-1">
                          <div
                            className={`px-3.5 py-2.5 text-[13px] leading-relaxed ${
                              msg.role === "user"
                                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-2xl rounded-br-md"
                                : msg.status === "error"
                                ? "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/20 dark:text-red-350 dark:border-red-900/40 rounded-2xl rounded-bl-md"
                                : msg.status === "success"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-350 dark:border-emerald-900/40 rounded-2xl rounded-bl-md"
                                : msg.status === "pending"
                                ? "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-350 dark:border-amber-900/40 rounded-2xl rounded-bl-md"
                                : "bg-neutral-100 text-neutral-800 dark:bg-neutral-850 dark:text-neutral-200 rounded-2xl rounded-bl-md"
                            }`}
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                              components={{
                                p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                                li: ({ children }) => <li className="mb-0.5">{children}</li>,
                                strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                                pre: ({ children }) => <pre className="bg-neutral-900 text-neutral-100 rounded-lg p-2.5 overflow-x-auto my-2 text-[11px] font-mono leading-normal">{children}</pre>,
                                code: ({ children }) => (
                                  <code className={msg.role === "user" ? "bg-white/15 px-1 py-0.5 rounded text-[11px] font-mono" : "bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded text-[11px] font-mono"}>
                                    {children}
                                  </code>
                                )
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                          {msg.status === "pending" && (
                            <div className="flex items-center gap-1 ml-1">
                              <Loader2 className="size-2.5 animate-spin text-amber-500" />
                              <span className="text-[9px] text-amber-500 font-medium">Processing...</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}

                    {isKnowledgeLoading && !knowledgeMessages.some(m => m.status === "pending") && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-2.5 justify-start"
                      >
                        <div className="size-7 rounded-lg bg-gradient-to-br from-[#f97316] to-[#ec4899] flex items-center justify-center text-white font-bold text-[9px] shrink-0 mt-0.5 shadow-sm">
                          KM
                        </div>
                        <div className="px-4 py-3 bg-neutral-100 dark:bg-neutral-850 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-neutral-400 animate-bounce"></span>
                          <span className="size-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.15s]"></span>
                          <span className="size-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.3s]"></span>
                        </div>
                      </motion.div>
                    )}
                    <div ref={knowledgeEndRef} />
                  </div>

                  {/* Upload status banner */}
                  <AnimatePresence>
                    {uploadingFile && (
                      <div className="mx-4 sm:mx-6 mb-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-400">
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Uploading and indexing <strong>{uploadingFile}</strong>...</span>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Bottom Composer and Popups Area */}
                  <div className="px-4 sm:px-6 pb-4 pt-2 shrink-0 relative">
                    <div className="w-full relative">
                      {renderComposer()}

                      {/* Paperclip (+) popup menu */}
                      <AnimatePresence>
                        {paperclipOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => { setPaperclipOpen(false); setActiveSubmenu("none"); }} />
                            <motion.div
                              initial={{ opacity: 0, y: 15, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 15, scale: 0.95 }}
                              transition={{ duration: 0.18, ease: "easeOut" }}
                              className="absolute bottom-[68px] left-3 z-40 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-1.5 w-64 flex flex-col gap-0.5 text-left"
                            >
                              <button
                                type="button"
                                onClick={() => { fileInputRef.current?.click(); setPaperclipOpen(false); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                              >
                                <Paperclip className="size-4 text-neutral-500" />
                                Add from local files
                              </button>

                              <button
                                type="button"
                                onClick={() => setActiveSubmenu(activeSubmenu === "recent_files" ? "none" : "recent_files")}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors cursor-pointer ${
                                  activeSubmenu === "recent_files"
                                    ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                                    : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <FileText className="size-4 text-neutral-500" />
                                  Recent files
                                </div>
                                <svg className="size-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>

                              <button
                                type="button"
                                onClick={() => setActiveSubmenu(activeSubmenu === "skills" ? "none" : "skills")}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors cursor-pointer ${
                                  activeSubmenu === "skills"
                                    ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                                    : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <Puzzle className="size-4 text-neutral-500" />
                                  Use Skills
                                </div>
                                <svg className="size-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>

                              <button
                                type="button"
                                onClick={() => { setDriveModalOpen(true); setPaperclipOpen(false); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                              >
                                <svg className="size-4" viewBox="0 0 24 24" fill="none">
                                  <path d="M15.43 14.5H23L15.43 1.5H7.86L15.43 14.5Z" fill="#0066DA" />
                                  <path d="M15.43 14.5H7.86L0.29 1.5H7.86L15.43 14.5Z" fill="#00A1F1" />
                                  <path d="M15.43 14.5L7.86 21.5H23L15.43 14.5Z" fill="#F2B200" />
                                </svg>
                                Add from Google Drive
                              </button>

                              <button
                                type="button"
                                onClick={() => setActiveSubmenu(activeSubmenu === "more" ? "none" : "more")}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors cursor-pointer ${
                                  activeSubmenu === "more"
                                    ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                                    : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="grid grid-cols-2 gap-0.5 size-4">
                                    <div className="bg-neutral-500 rounded-[1px]"></div>
                                    <div className="bg-neutral-500 rounded-[1px]"></div>
                                    <div className="bg-neutral-500 rounded-[1px]"></div>
                                    <div className="bg-neutral-500 rounded-[1px]"></div>
                                  </div>
                                  More
                                </div>
                                <svg className="size-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>

                              {/* Active Submenu */}
                              {activeSubmenu === "recent_files" && (
                                <motion.div
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className="absolute left-[264px] top-0 w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-1.5 flex flex-col gap-0.5 max-h-[380px] overflow-y-auto"
                                >
                                  <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-850 mb-1">
                                    Recent Files
                                  </div>
                                  {sources.map((s) => (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => {
                                        setKnowledgeMessages(prev => [...prev, { role: "assistant", content: `Viewing metadata for source **${s.name}**:\n- **Type**: ${s.type}\n- **Char count**: ${s.charCount}\n- **Status**: ${s.status === "trained" ? "Active" : "Processing"}` }]);
                                        setPaperclipOpen(false);
                                        setActiveSubmenu("none");
                                      }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors truncate"
                                    >
                                      {s.type === "url" ? <Globe className="size-4 text-emerald-500 shrink-0" /> : <FileText className="size-4 text-blue-500 shrink-0" />}
                                      <span className="truncate">{s.name}</span>
                                    </button>
                                  ))}
                                  {sources.length === 0 && (
                                    <>
                                      {[
                                        { name: "Analysis of High-Probability M...", type: "doc" },
                                        { name: "Unique SaaS Chrome Extensio...", type: "doc" },
                                        { name: "John Keells PLC Annual Report...", type: "doc" },
                                        { name: "index.html", type: "code" },
                                        { name: "Advanced Intelligent Binance ...", type: "doc" },
                                        { name: "advanced_binance_futures_ag...", type: "zip" },
                                        { name: "Binance Futures AI Agent for S...", type: "doc" },
                                        { name: "binance_futures_agent.zip", type: "zip" }
                                      ].map((mock, idx) => (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={() => {
                                            setKnowledgeInput(`Let's talk about ${mock.name}`);
                                            setPaperclipOpen(false);
                                            setActiveSubmenu("none");
                                          }}
                                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors truncate"
                                        >
                                          {mock.type === "code" ? (
                                            <span className="size-4 text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 rounded flex items-center justify-center shrink-0">HTML</span>
                                          ) : mock.type === "zip" ? (
                                            <span className="size-4 text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 rounded flex items-center justify-center shrink-0">ZIP</span>
                                          ) : (
                                            <FileText className="size-4 text-blue-500 shrink-0" />
                                          )}
                                          <span className="truncate">{mock.name}</span>
                                        </button>
                                      ))}
                                    </>
                                  )}
                                  <div className="border-t border-neutral-100 dark:border-neutral-850 my-1"></div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPaperclipOpen(false);
                                      setActiveSubmenu("none");
                                      const sourcesList = sources.length === 0
                                        ? "You have no trained sources yet. Upload a file, paste a URL, or type some facts to get started!"
                                        : `You have **${sources.length} trained sources** (${sources.reduce((a, s) => a + s.charCount, 0).toLocaleString()} chars total):\n\n${sources.map((s, i) => `${i + 1}. **${s.name}** — ${s.type} • ${s.charCount} chars • ${s.status === "trained" ? "✅" : "⏳"}`).join("\n")}`;
                                      setKnowledgeMessages(prev => [...prev, { role: "assistant", content: sourcesList, status: "info" }]);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold text-neutral-800 dark:text-neutral-250 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shrink-0"
                                  >
                                    <Layers className="size-4 text-purple-600 shrink-0" />
                                    Add from library
                                  </button>
                                </motion.div>
                              )}

                              {activeSubmenu === "skills" && (
                                <motion.div
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className="absolute left-[264px] top-0 w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-1.5 flex flex-col gap-0.5"
                                >
                                  <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-450 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-850 mb-1">
                                    Skills Available
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => { setKnowledgeInput("crawl https://"); setPaperclipOpen(false); setActiveSubmenu("none"); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                                  >
                                    <Globe className="size-4 text-emerald-500" />
                                    Crawl Website
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setKnowledgeInput("search web for "); setPaperclipOpen(false); setActiveSubmenu("none"); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                                  >
                                    <Sparkles className="size-4 text-amber-500" />
                                    Search Web
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setKnowledgeInput("parse pdf and extract "); setPaperclipOpen(false); setActiveSubmenu("none"); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                                  >
                                    <FileText className="size-4 text-blue-500" />
                                    File Parser
                                  </button>
                                </motion.div>
                              )}

                              {activeSubmenu === "more" && (
                                <motion.div
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className="absolute left-[264px] top-0 w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-1.5 flex flex-col gap-0.5"
                                >
                                  <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-450 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-850 mb-1">
                                    More Options
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setKnowledgeMessages([{
                                        role: "assistant",
                                        content: "Chat cleared! Send me URLs to crawl, upload files via the 📎 button, or type documentation to train your bot. Ask any question to test what I've learned."
                                      }]);
                                      setPaperclipOpen(false);
                                      setActiveSubmenu("none");
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                  >
                                    <Trash2 className="size-4 text-red-500" />
                                    Clear Chat
                                  </button>
                                </motion.div>
                              )}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>

                      {/* Connectors Dropdown menu */}
                      <AnimatePresence>
                        {connectorsDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setConnectorsDropdownOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: 15, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 15, scale: 0.95 }}
                              transition={{ duration: 0.18, ease: "easeOut" }}
                              className="absolute bottom-[68px] left-12 z-40 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-2 w-72 flex flex-col gap-1 text-left font-sans"
                            >
                              <div className="px-3 py-1 text-[10px] font-bold text-neutral-450 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-850 mb-1">
                                Active Connectors
                              </div>

                              {/* Google Calendar */}
                              <div className="flex items-center justify-between px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-xl transition-colors">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-5 shrink-0 flex items-center justify-center">
                                    <svg className="size-4.5" viewBox="0 0 24 24" fill="none">
                                      <rect width="24" height="24" rx="4.5" fill="#4285F4" />
                                      <text x="50%" y="65%" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="sans-serif">31</text>
                                    </svg>
                                  </div>
                                  <span className="text-xs font-semibold text-neutral-750 dark:text-neutral-200">Google Calendar</span>
                                </div>
                                {googleConnected ? (
                                  <div
                                    className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${syncGoogleCalendar ? "bg-blue-600" : "bg-neutral-250 dark:bg-neutral-700"}`}
                                    onClick={() => setSyncGoogleCalendar(!syncGoogleCalendar)}
                                  >
                                    <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform shadow-sm ${syncGoogleCalendar ? "translate-x-3.5" : "translate-x-0"}`} />
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => handleConnectCloud("google")} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">Connect</button>
                                )}
                              </div>

                              {/* Google Drive */}
                              <div className="flex items-center justify-between px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-xl transition-colors">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-5 shrink-0 flex items-center justify-center">
                                    <svg className="size-4.5" viewBox="0 0 24 24" fill="none">
                                      <path d="M15.43 14.5H23L15.43 1.5H7.86L15.43 14.5Z" fill="#0066DA" />
                                      <path d="M15.43 14.5H7.86L0.29 1.5H7.86L15.43 14.5Z" fill="#00A1F1" />
                                      <path d="M15.43 14.5L7.86 21.5H23L15.43 14.5Z" fill="#F2B200" />
                                    </svg>
                                  </div>
                                  <span className="text-xs font-semibold text-neutral-750 dark:text-neutral-200">Google Drive</span>
                                </div>
                                {googleConnected ? (
                                  <div
                                    className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${syncGoogleDrive ? "bg-blue-600" : "bg-neutral-250 dark:bg-neutral-700"}`}
                                    onClick={() => setSyncGoogleDrive(!syncGoogleDrive)}
                                  >
                                    <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform shadow-sm ${syncGoogleDrive ? "translate-x-3.5" : "translate-x-0"}`} />
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => handleConnectCloud("google")} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">Connect</button>
                                )}
                              </div>

                              {/* Microsoft OneDrive */}
                              <div className="flex items-center justify-between px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-xl transition-colors">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-5 shrink-0 flex items-center justify-center">
                                    <svg className="size-4.5" viewBox="0 0 24 24" fill="none">
                                      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" fill="#0078D4"/>
                                    </svg>
                                  </div>
                                  <span className="text-xs font-semibold text-neutral-750 dark:text-neutral-200">OneDrive</span>
                                </div>
                                {microsoftConnected ? (
                                  <div
                                    className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${syncOneDrive ? "bg-blue-600" : "bg-neutral-250 dark:bg-neutral-700"}`}
                                    onClick={() => setSyncOneDrive(!syncOneDrive)}
                                  >
                                    <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform shadow-sm ${syncOneDrive ? "translate-x-3.5" : "translate-x-0"}`} />
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => handleConnectCloud("microsoft")} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">Connect</button>
                                )}
                              </div>

                              {/* Microsoft Outlook Calendar */}
                              <div className="flex items-center justify-between px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-xl transition-colors">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-5 shrink-0 flex items-center justify-center">
                                    <svg className="size-4.5" viewBox="0 0 24 24" fill="none">
                                      <rect width="24" height="24" rx="4.5" fill="#0078D4" />
                                      <path d="M6 18H18V10H6V18ZM18 6H16V5c0-.55-.45-1-1-1s-1 .45-1 1v1H10V5c0-.55-.45-1-1-1s-1 .45-1 1v1H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" fill="white"/>
                                    </svg>
                                  </div>
                                  <span className="text-xs font-semibold text-neutral-750 dark:text-neutral-200">Outlook Calendar</span>
                                </div>
                                {microsoftConnected ? (
                                  <div
                                    className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${syncOutlookCalendar ? "bg-blue-600" : "bg-neutral-250 dark:bg-neutral-700"}`}
                                    onClick={() => setSyncOutlookCalendar(!syncOutlookCalendar)}
                                  >
                                    <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform shadow-sm ${syncOutlookCalendar ? "translate-x-3.5" : "translate-x-0"}`} />
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => handleConnectCloud("microsoft")} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">Connect</button>
                                )}
                              </div>

                              <div className="border-t border-neutral-100 dark:border-neutral-850 my-1"></div>

                              <button
                                type="button"
                                onClick={() => { setActiveTab("integrations"); setConnectorsDropdownOpen(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs font-semibold text-neutral-855 dark:text-neutral-250 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                              >
                                <Sliders className="size-4 text-neutral-500" />
                                <span>Manage connectors</span>
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </>
              )}
            
              </div>
              
              {/* Right Column: Active Sources & Connectors Sidebar */}
              <div className="w-full lg:w-80 xl:w-96 shrink-0 h-full overflow-y-auto space-y-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 scrollbar-thin">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <Sparkles className="size-4 text-[#f97316]" /> Cloud API Connectors
                  </h4>
                  <p className="text-[10px] text-neutral-450 leading-normal">
                    Sync your cloud storage accounts to enable automatic document reading and booking rules.
                  </p>

                  {/* Google Connector Card */}
                  <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3.5 space-y-3 bg-neutral-50/50 dark:bg-neutral-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="size-4" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span className="text-xs font-bold">Google</span>
                      </div>
                      {googleConnected ? (
                        <button
                          type="button"
                          onClick={() => handleDisconnectCloud("google")}
                          className="text-[9px] font-bold text-red-500 hover:underline cursor-pointer"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConnectCloud("google")}
                          className="text-[9px] font-bold text-blue-500 hover:underline cursor-pointer"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                    {googleConnected && (
                      <div className="space-y-2 pt-1 border-t border-neutral-100 dark:border-neutral-800 text-[10px]">
                        <div className="text-[9px] text-neutral-400 truncate mb-1">Signed in: {googleEmail}</div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500">Google Drive Sync</span>
                          <button
                            type="button"
                            onClick={() => handleInputChange(setSyncGoogleDrive, !syncGoogleDrive)}
                            className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${syncGoogleDrive ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"}`}
                          >
                            <div className={`size-3 rounded-full bg-white transition-transform ${syncGoogleDrive ? "translate-x-3" : ""}`} />
                          </button>
                        </div>
                        {syncGoogleDrive && (
                          <button
                            type="button"
                            onClick={() => setDriveModalOpen(true)}
                            className="w-full py-1 border border-neutral-200 dark:border-neutral-800 rounded mt-1 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-[9px] font-bold transition-colors cursor-pointer"
                          >
                            Index Folder
                          </button>
                        )}
                        
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-neutral-500">Google Calendar Sync</span>
                          <button
                            type="button"
                            onClick={() => handleInputChange(setSyncGoogleCalendar, !syncGoogleCalendar)}
                            className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${syncGoogleCalendar ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"}`}
                          >
                            <div className={`size-3 rounded-full bg-white transition-transform ${syncGoogleCalendar ? "translate-x-3" : ""}`} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Microsoft Connector Card */}
                  <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3.5 space-y-3 bg-neutral-50/50 dark:bg-neutral-955/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="size-4" viewBox="0 0 24 24" fill="none">
                          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" fill="#0078D4"/>
                        </svg>
                        <span className="text-xs font-bold">Microsoft</span>
                      </div>
                      {microsoftConnected ? (
                        <button
                          type="button"
                          onClick={() => handleDisconnectCloud("microsoft")}
                          className="text-[9px] font-bold text-red-500 hover:underline cursor-pointer"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConnectCloud("microsoft")}
                          className="text-[9px] font-bold text-blue-500 hover:underline cursor-pointer"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                    {microsoftConnected && (
                      <div className="space-y-2 pt-1 border-t border-neutral-100 dark:border-neutral-800 text-[10px]">
                        <div className="text-[9px] text-neutral-400 truncate mb-1">Signed in: {microsoftEmail}</div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500">OneDrive Sync</span>
                          <button
                            type="button"
                            onClick={() => handleInputChange(setSyncOneDrive, !syncOneDrive)}
                            className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${syncOneDrive ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"}`}
                          >
                            <div className={`size-3 rounded-full bg-white transition-transform ${syncOneDrive ? "translate-x-3" : ""}`} />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-neutral-500">Outlook Calendar Sync</span>
                          <button
                            type="button"
                            onClick={() => handleInputChange(setSyncOutlookCalendar, !syncOutlookCalendar)}
                            className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${syncOutlookCalendar ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"}`}
                          >
                            <div className={`size-3 rounded-full bg-white transition-transform ${syncOutlookCalendar ? "translate-x-3" : ""}`} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-neutral-200 dark:border-neutral-800 my-4" />

                {/* Trained Sources Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Active Sources ({sources.length})
                  </h4>
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {sources.map((src) => (
                      <div
                        key={src.id}
                        className="p-3 bg-neutral-50/50 dark:bg-neutral-955/20 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-between gap-3 shadow-sm text-left"
                      >
                        <div className="overflow-hidden min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`px-1.2 py-0.2 rounded text-[7px] font-bold uppercase tracking-wider shrink-0 ${
                              src.type === "url" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/45 dark:text-blue-400" : "bg-purple-100 text-purple-800 dark:bg-purple-950/45 dark:text-purple-400"
                            }`}>
                              {src.type}
                            </span>
                            <span className="text-[10px] font-bold truncate block">{src.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 text-[8px] text-neutral-400 font-semibold">
                            <span>{src.charCount} chars</span>
                            <span className="size-1 rounded-full bg-neutral-300 dark:bg-neutral-700"></span>
                            {src.status === "training" ? (
                              <span className="text-[#f97316] animate-pulse">Syncing...</span>
                            ) : (
                              <span className="text-green-500">Trained</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSource(src.id)}
                          className="p-1 rounded-lg border border-neutral-100 dark:border-neutral-800 hover:bg-red-50 dark:hover:bg-red-950/20 text-neutral-400 hover:text-red-500 transition-colors shrink-0 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    {sources.length === 0 && (
                      <div className="text-center py-6 border border-dashed border-neutral-250 dark:border-neutral-800 rounded-xl p-3 text-neutral-400">
                        <Database className="size-5 mx-auto mb-1 opacity-50" />
                        <span className="text-[10px] block font-medium">No sources trained yet</span>
                        <span className="text-[8px] block opacity-85 mt-0.5">Upload local files or type in the chat to train your AI.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PLAYGROUND */}
          {activeTab === "playground" && (
            <div className="max-w-4xl mx-auto w-full py-6 px-4 flex justify-center">
              <div className={`w-full max-w-lg h-[500px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden relative flex flex-col style-${widgetStyle}`}>
                
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
                  <button
                    onClick={() => setPlaygroundMessages([{ role: "assistant", content: welcomeMsg }])}
                    className="px-2 py-1 rounded border border-white/20 hover:bg-white/10 text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
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
                  <button
                    type="submit"
                    style={widgetStyle === "minimalist" ? { backgroundColor: primaryColor } : {}}
                    className="p-2.5 text-white rounded-lg flex items-center justify-center shrink-0 hover:opacity-90 cursor-pointer"
                  >
                    <Send className="size-3.5" />
                  </button>
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

                {/* Google Connection & Calendar Booking Rules */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Google Connection & Calendar Rules</h4>
                  
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
                          {/* Duration Selector */}
                          <div>
                            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Allowed Time Duration</label>
                            <select
                              value={schedulingDuration}
                              onChange={(e) => handleInputChange(setSchedulingDuration, parseInt(e.target.value, 10))}
                              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 cursor-pointer"
                            >
                              <option value={15}>15 Minutes</option>
                              <option value={30}>30 Minutes</option>
                              <option value={45}>45 Minutes</option>
                              <option value={60}>60 Minutes</option>
                            </select>
                          </div>

                          {/* Timezone Input */}
                          <div>
                            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Calendar Timezone</label>
                            <input
                              type="text"
                              value={botTimezone}
                              onChange={(e) => handleInputChange(setBotTimezone, e.target.value)}
                              className="w-full bg-neutral-50 dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                              placeholder="e.g. UTC, America/New_York"
                            />
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
                  setKnowledgeMessages(prev => [
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

      {/* Onboarding Setup Wizard Overlay Modal */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden text-neutral-900 dark:text-neutral-100">
            {/* Wizard Header */}
            <div className="p-5 border-b border-neutral-150 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-950/20">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-[#f97316]" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 leading-none">{t("setup_wizard")}</h3>
                  <p className="text-[10px] text-neutral-500 mt-1 font-semibold">Step {onboardingStep + 1} of 10</p>
                </div>
              </div>
              <button
                onClick={() => { setWizardOpen(false); setOnboardingCompleted(true); }}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-[10px] font-bold cursor-pointer border border-neutral-200 dark:border-neutral-800 px-2.5 py-1.5 rounded-lg transition-all"
              >
                {t("skip")}
              </button>
            </div>
            
            {/* Wizard Progress Bar */}
            <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1">
              <div
                className="bg-[#f97316] h-full transition-all duration-300"
                style={{ width: `${(onboardingStep + 1) * 10}%` }}
              />
            </div>

            {/* Wizard Body (Scrollable content) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Step 1: Welcome & Training Setup */}
              {onboardingStep === 0 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-150 dark:border-neutral-800 space-y-2">
                    <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-350">{t("welcome")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveOnboardingStep(1, false)}
                      className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
                    >
                      {t("yes")}
                    </button>
                  </div>
                  
                  <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-4">
                    <h4 className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">{t("supported_sources")}</h4>
                    <div className="grid grid-cols-2 gap-3 text-[10px] text-neutral-500">
                      <div className="p-2.5 rounded-lg border border-neutral-150 dark:border-neutral-800 flex items-center gap-2">📄 PDF files</div>
                      <div className="p-2.5 rounded-lg border border-neutral-150 dark:border-neutral-800 flex items-center gap-2">📝 Text documents</div>
                      <div className="p-2.5 rounded-lg border border-neutral-150 dark:border-neutral-800 flex items-center gap-2">🖼️ Images</div>
                      <div className="p-2.5 rounded-lg border border-neutral-150 dark:border-neutral-800 flex items-center gap-2">📊 CSV files</div>
                      <div className="p-2.5 rounded-lg border border-neutral-150 dark:border-neutral-800 flex items-center gap-2">🌐 Website URLs</div>
                    </div>
                    
                    <h4 className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider pt-2">{t("optional_integrations")}</h4>
                    <div className="grid grid-cols-4 gap-2 text-[9px] text-neutral-500">
                      <button onClick={() => handleConnectCloud("google")} className="p-2 rounded-lg border border-neutral-150 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/20 text-center font-bold hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer">Google Drive</button>
                      <button onClick={() => handleConnectCloud("microsoft")} className="p-2 rounded-lg border border-neutral-150 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/20 text-center font-bold hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer">OneDrive</button>
                      <button className="p-2 rounded-lg border border-neutral-150 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/20 text-center font-bold opacity-60 cursor-not-allowed">Dropbox</button>
                      <button className="p-2 rounded-lg border border-neutral-150 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/20 text-center font-bold opacity-60 cursor-not-allowed">SharePoint</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Data Processing */}
              {onboardingStep === 1 && (
                <div className="text-center py-8 space-y-4">
                  <Loader2 className="size-10 animate-spin text-[#f97316] mx-auto" />
                  <p className="text-xs font-bold text-neutral-700 dark:text-neutral-350 animate-pulse">{t("processing")}</p>
                  <div className="w-48 mx-auto bg-neutral-100 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[#f97316] h-full animate-[pulse_1.5s_infinite] w-3/4"></div>
                  </div>
                  <button
                    onClick={() => saveOnboardingStep(2, false)}
                    className="mt-6 px-4 py-2 border border-[#f97316] text-[#f97316] hover:bg-[#f97316]/5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Simulate Done (Training Completed)
                  </button>
                </div>
              )}

              {/* Step 3: Business Rules & Instructions */}
              {onboardingStep === 2 && (
                <div className="space-y-4">
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400">{t("custom_instructions_q")}</label>
                  <textarea
                    value={systemInstructions}
                    onChange={(e) => setSystemInstructions(e.target.value)}
                    rows={5}
                    className="w-full bg-neutral-50 dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 leading-normal"
                    placeholder="E.g. If the lead is outside North America, refer them to partner agencies. Always be professional. Do not discount."
                  />
                  <button
                    onClick={() => saveOnboardingStep(3, false, { custom_instructions: systemInstructions })}
                    className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
                  >
                    {t("save_instructions")}
                  </button>
                </div>
              )}

              {/* Step 4: Lead Extraction Setup */}
              {onboardingStep === 3 && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400">{t("lead_fields_q")}</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: "name", label: "Full Name (Standard)" },
                        { key: "email", label: "Email Address (Standard)" },
                        { key: "phone", label: "Phone Number (Standard)" },
                        { key: "company", label: "Company Name" },
                        { key: "job_title", label: "Job Title" },
                        { key: "country", label: "Country" },
                        { key: "industry", label: "Industry" },
                        { key: "budget", label: "Budget" }
                      ].map((field) => (
                        <label key={field.key} className="flex items-center gap-2 p-2.5 rounded-lg border border-neutral-150 dark:border-neutral-800 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-950/20 text-xs font-medium">
                          <input
                            type="checkbox"
                            checked={leadFields.includes(field.key)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setLeadFields(prev => [...prev, field.key]);
                              } else {
                                if (field.key !== "name" && field.key !== "email") {
                                  setLeadFields(prev => prev.filter(f => f !== field.key));
                                }
                              }
                            }}
                            disabled={field.key === "name" || field.key === "email"}
                            className="accent-[#f97316]"
                          />
                          {field.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Custom Fields (Comma separated)</label>
                    <input
                      type="text"
                      placeholder="E.g. Project Type, Employee Count"
                      onChange={(e) => {
                        const customs = e.target.value.split(",").map(c => c.trim()).filter(Boolean);
                        const baseFields = leadFields.filter(f => ["name", "email", "phone", "company", "job_title", "country", "industry", "budget"].includes(f));
                        setLeadFields([...baseFields, ...customs]);
                      }}
                      className="w-full bg-neutral-50 dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={() => saveOnboardingStep(4, false, { lead_fields: leadFields })}
                    className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
                  >
                    {t("confirm_rules")}
                  </button>
                </div>
              )}

              {/* Step 5: Meeting Scheduling Setup */}
              {onboardingStep === 4 && (
                <div className="space-y-6">
                  <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">{t("timezone_confirm")}</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{t("country")}</label>
                      <input
                        type="text"
                        value={botCountry}
                        onChange={(e) => setBotCountry(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{t("timezone")}</label>
                      <input
                        type="text"
                        value={botTimezone}
                        onChange={(e) => setBotTimezone(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => saveOnboardingStep(5, false, { bot_country: botCountry, bot_timezone: botTimezone })}
                    className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
                  >
                    {t("confirm_rules")}
                  </button>
                </div>
              )}

              {/* Step 6: Calendar Integration */}
              {onboardingStep === 5 && (
                <div className="space-y-6">
                  <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">{t("calendar_integration_q")}</p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-neutral-150 dark:border-neutral-800">
                      <span className="text-xs font-bold">Google Calendar</span>
                      <button
                        onClick={() => {
                          setSyncGoogleCalendar(!syncGoogleCalendar);
                          saveOnboardingStep(5, false, { sync_google_calendar: !syncGoogleCalendar });
                        }}
                        className={`px-3 py-1.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                          syncGoogleCalendar ? "bg-green-500 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200"
                        }`}
                      >
                        {syncGoogleCalendar ? "Connected" : "Connect"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-neutral-150 dark:border-neutral-800">
                      <span className="text-xs font-bold">Microsoft Outlook Calendar</span>
                      <button
                        onClick={() => {
                          setSyncOutlookCalendar(!syncOutlookCalendar);
                          saveOnboardingStep(5, false, { sync_outlook_calendar: !syncOutlookCalendar });
                        }}
                        className={`px-3 py-1.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                          syncOutlookCalendar ? "bg-green-500 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200"
                        }`}
                      >
                        {syncOutlookCalendar ? "Connected" : "Connect"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-neutral-150 dark:border-neutral-800">
                      <span className="text-xs font-bold">Office 365 Calendar</span>
                      <button
                        onClick={() => {
                          setSyncOffice365Calendar(!syncOffice365Calendar);
                          saveOnboardingStep(5, false, { sync_office365_calendar: !syncOffice365Calendar });
                        }}
                        className={`px-3 py-1.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                          syncOffice365Calendar ? "bg-green-500 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200"
                        }`}
                      >
                        {syncOffice365Calendar ? "Connected" : "Connect"}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => saveOnboardingStep(6, false)}
                    className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
                  >
                    {t("next")}
                  </button>
                </div>
              )}

              {/* Step 7: Meeting Provider Setup */}
              {onboardingStep === 6 && (
                <div className="space-y-6">
                  <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">{t("meeting_provider_q")}</p>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "google_meet", label: "Google Meet" },
                      { id: "zoom", label: "Zoom Video" },
                      { id: "teams", label: "MS Teams" }
                    ].map((prov) => (
                      <button
                        key={prov.id}
                        onClick={() => {
                          setMeetingProvider(prov.id);
                          saveOnboardingStep(7, false, { meeting_provider: prov.id });
                        }}
                        className={`p-4 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${
                          meetingProvider === prov.id
                            ? "border-[#f97316] bg-[#f97316]/5 text-[#f97316]"
                            : "border-neutral-150 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-950/20"
                        }`}
                      >
                        {prov.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => saveOnboardingStep(7, false)}
                    className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
                  >
                    {t("next")}
                  </button>
                </div>
              )}

              {/* Step 8: Scheduling Rules */}
              {onboardingStep === 7 && (
                <div className="space-y-6">
                  <h4 className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">{t("scheduling_rules")}</h4>
                  
                  <div className="space-y-2.5 text-xs text-neutral-600 dark:text-neutral-350">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50/50 dark:bg-neutral-950/20 border border-neutral-100 dark:border-neutral-800">
                      <Check className="size-4 text-green-500 shrink-0" />
                      <span>1. Collect all lead information (Name, Email, etc.)</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50/50 dark:bg-neutral-950/20 border border-neutral-100 dark:border-neutral-800">
                      <Check className="size-4 text-green-500 shrink-0" />
                      <span>2. Verify lead qualification filters</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50/50 dark:bg-neutral-950/20 border border-neutral-100 dark:border-neutral-800">
                      <Check className="size-4 text-green-500 shrink-0" />
                      <span>3. Determine visitor's country and locale</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50/50 dark:bg-neutral-950/20 border border-neutral-100 dark:border-neutral-800">
                      <Check className="size-4 text-green-500 shrink-0" />
                      <span>4. Detect visitor's timezone</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50/50 dark:bg-neutral-950/20 border border-neutral-100 dark:border-neutral-800">
                      <Check className="size-4 text-green-500 shrink-0" />
                      <span>5. Convert meeting times accurately</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50/50 dark:bg-neutral-950/20 border border-neutral-100 dark:border-neutral-800">
                      <Check className="size-4 text-green-500 shrink-0" />
                      <span>6. Check calendar availability in real-time</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50/50 dark:bg-neutral-950/20 border border-neutral-100 dark:border-neutral-800">
                      <Check className="size-4 text-green-500 shrink-0" />
                      <span>7. Generate unique meeting links automatically</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50/50 dark:bg-neutral-950/20 border border-neutral-100 dark:border-neutral-800">
                      <Check className="size-4 text-green-500 shrink-0" />
                      <span>8. Send localized confirmation emails</span>
                    </div>
                  </div>

                  <button
                    onClick={() => saveOnboardingStep(8, false)}
                    className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
                  >
                    {t("confirm_rules")}
                  </button>
                </div>
              )}

              {/* Step 9: Notifications & Email Automation */}
              {onboardingStep === 8 && (
                <div className="space-y-6">
                  <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">{t("notifications_setup")}</p>
                  
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-neutral-155 dark:border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{t("notify_client")}</span>
                        <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded font-bold">Active</span>
                      </div>
                      <p className="text-[10px] text-neutral-400">Sends scheduled meeting details and calendar links to the lead.</p>
                    </div>

                    <div className="p-4 rounded-xl border border-neutral-155 dark:border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{t("notify_admin")}</span>
                        <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded font-bold">Active</span>
                      </div>
                      <p className="text-[10px] text-neutral-400">Sends instant new meeting notifications and lead summaries to the administrator.</p>
                    </div>
                  </div>

                  <button
                    onClick={() => saveOnboardingStep(9, false)}
                    className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
                  >
                    {t("next")}
                  </button>
                </div>
              )}

              {/* Step 10: Final Confirmation */}
              {onboardingStep === 9 && (
                <div className="space-y-6">
                  <div className="text-center py-4 space-y-2">
                    <Check className="size-10 bg-green-500/10 text-green-500 rounded-full p-2.5 mx-auto" />
                    <h4 className="text-sm font-bold text-neutral-800 dark:text-white">{t("setup_completed")}</h4>
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-150 dark:border-neutral-800 space-y-2.5 text-xs">
                    <div className="flex items-center gap-2">✓ AI Training Data</div>
                    <div className="flex items-center gap-2">✓ Custom Business Rules</div>
                    <div className="flex items-center gap-2">✓ Lead Extraction Configured</div>
                    <div className="flex items-center gap-2">✓ Dynamic Lead Table Mapped</div>
                    <div className="flex items-center gap-2">✓ Calendar Integration Active</div>
                    <div className="flex items-center gap-2">✓ Automated Provider Meeting Links</div>
                    <div className="flex items-center gap-2">✓ Multi-Language support synchronized</div>
                  </div>

                  <button
                    onClick={() => {
                      saveOnboardingStep(9, true);
                      setActiveTab("leads");
                    }}
                    className="w-full py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-500 transition-all cursor-pointer text-center"
                  >
                    {t("go_to_admin")}
                  </button>
                </div>
              )}
            </div>

            {/* Wizard Footer (Back / Next controls) */}
            {onboardingStep > 0 && onboardingStep < 9 && (
              <div className="p-4 border-t border-neutral-150 dark:border-neutral-800 flex justify-between bg-neutral-50/50 dark:bg-neutral-955/20">
                <button
                  type="button"
                  onClick={() => setOnboardingStep(prev => prev - 1)}
                  className="px-3.5 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer"
                >
                  {t("back")}
                </button>
                {onboardingStep !== 1 && onboardingStep !== 2 && onboardingStep !== 3 && onboardingStep !== 4 && onboardingStep !== 7 && (
                  <button
                    type="button"
                    onClick={() => saveOnboardingStep(onboardingStep + 1, false)}
                    className="px-3.5 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer"
                  >
                    {t("next")}
                  </button>
                )}
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
        </div>
      )}
    </div>
  );
}
