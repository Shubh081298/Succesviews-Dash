/**
 * AppDataContext.jsx
 * ─────────────────────────────────────────────────────────────
 * Shared "backend/database" layer for SuccessViews.
 *
 * The Employee Portal and Admin Portal are now two completely
 * separate React trees (separate routes, separate login screens,
 * separate layouts/navigation — see src/portals/employee and
 * src/portals/admin). They are NOT allowed to share UI code, but
 * the product spec explicitly allows them to share the same data:
 * employees, DSR submissions, departments, leaves, salaries, etc.
 *
 * This context is that shared layer. It owns all persisted state
 * and the mutation helpers ("save*") that both portals call into.
 * Nothing UI-specific (which tab is active, which modal is open,
 * login-form input values, etc.) lives here — that stays local to
 * each portal, since that's per-portal presentation state, not
 * shared business data.
 */
import { createContext, useContext, useState, useEffect } from "react";
import {
  DEPARTMENTS, DEF_WEBSITES, DEF_TARGETS, DEFAULT_ADMIN_PWD,
} from "../utils/constants";
import { normalizeEmps } from "../utils/helpers";
import { storageGet, storageSet } from "../utils/storage";
import logoDefault from "../assets/successviews-logo.png";

const SEED_EMPLOYEES = [
  { id: "EMP001", name: "Aarav Sharma", department: "Sales", code: "1001", password: "1234", teamLead: "Priya Singh", photo: "" },
  { id: "EMP002", name: "Priya Singh", department: "Sales", code: "1002", password: "1234", teamLead: "", photo: "" },
  { id: "EMP003", name: "Rohan Mehta", department: "Operations", code: "1003", password: "1234", teamLead: "Neha Kapoor", photo: "" },
  { id: "EMP004", name: "Neha Kapoor", department: "Operations", code: "1004", password: "1234", teamLead: "", photo: "" },
];

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const [theme, setTheme] = useState("light");

  const [employees, setEmployees] = useState(SEED_EMPLOYEES);
  const [submissions, setSubmissions] = useState([]);
  const [departments, setDepartments] = useState(DEPARTMENTS);
  const [websites, setWebsites] = useState(DEF_WEBSITES);
  const [targets, setTargets] = useState(DEF_TARGETS);
  const [customFields, setCustomFields] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [messages, setMessages] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [salaries, setSalaries] = useState({});
  const [insertionOrders, setInsertionOrders] = useState([]);
  const [logo, setLogo] = useState(logoDefault);
  const [adminPwd, setAdminPwdState] = useState(DEFAULT_ADMIN_PWD);

  const [toast, setToast] = useState(null);
  const [notifications, setNotifications] = useState([]);

  /* ── Bootstrap: load persisted state once on mount ───────── */
  useEffect(() => {
    (async () => {
      const raw = await storageGet("svd_employees");
      if (raw) setEmployees(normalizeEmps(JSON.parse(raw)));
      const subs = await storageGet("svd_submissions");
      if (subs) setSubmissions(JSON.parse(subs));
      const depts = await storageGet("svd_departments");
      if (depts) setDepartments(JSON.parse(depts));
      const sites = await storageGet("svd_websites");
      if (sites) setWebsites(JSON.parse(sites));
      const tgts = await storageGet("svd_tgts");
      if (tgts) setTargets(JSON.parse(tgts));
      const cfs = await storageGet("svd_customfields");
      if (cfs) setCustomFields(JSON.parse(cfs));
      const anns = await storageGet("svd_announcements");
      if (anns) setAnnouncements(JSON.parse(anns));
      const msgs = await storageGet("svd_messages");
      if (msgs) setMessages(JSON.parse(msgs));
      const lvs = await storageGet("svd_leaves");
      if (lvs) setLeaves(JSON.parse(lvs));
      const sals = await storageGet("svd_salaries");
      if (sals) setSalaries(JSON.parse(sals));
      const ios = await storageGet("svd_ios");
      if (ios) setInsertionOrders(JSON.parse(ios));
      const pwd = await storageGet("svd_admin_pwd");
      if (pwd) setAdminPwdState(pwd);
      const lg = await storageGet("svd_logo");
      if (lg) setLogo(lg);
      const th = await storageGet("svd_theme");
      if (th) setTheme(th);
    })();
  }, []);

  /* ── Persistence helpers — call after every mutation ─────── */
  const saveSubs = (next) => { setSubmissions(next); storageSet("svd_submissions", JSON.stringify(next)); };
  const saveEmployees = (next) => { setEmployees(next); storageSet("svd_employees", JSON.stringify(next)); };
  const saveDepartments = (next) => { setDepartments(next); storageSet("svd_departments", JSON.stringify(next)); };
  const saveWebsites = (next) => { setWebsites(next); storageSet("svd_websites", JSON.stringify(next)); };
  const saveCustomFields = (next) => { setCustomFields(next); storageSet("svd_customfields", JSON.stringify(next)); };
  const saveAnnouncements = (next) => { setAnnouncements(next); storageSet("svd_announcements", JSON.stringify(next)); };
  const saveMessages = (next) => { setMessages(next); storageSet("svd_messages", JSON.stringify(next)); };
  const saveLeaves = (next) => { setLeaves(next); storageSet("svd_leaves", JSON.stringify(next)); };
  const saveSalaries = (next) => { setSalaries(next); storageSet("svd_salaries", JSON.stringify(next)); };
  const saveIOs = (next) => { setInsertionOrders(next); storageSet("svd_ios", JSON.stringify(next)); };
  const saveTargets = (next) => { setTargets(next); storageSet("svd_tgts", JSON.stringify(next)); };
  const setAdminPwd = (v) => { setAdminPwdState(v); storageSet("svd_admin_pwd", v); };

  const showToast = (msg, kind = "info") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  };
  const pushNotification = (msg) => {
    setNotifications((n) => [{ id: Date.now(), msg, ts: Date.now() }, ...n].slice(0, 50));
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    storageSet("svd_theme", next);
  };

  const onLogoChange = (dataUrl) => { setLogo(dataUrl); storageSet("svd_logo", dataUrl); };
  const onLogoRemove = () => { setLogo(logoDefault); storageSet("svd_logo", ""); };

  const value = {
    theme, toggleTheme,
    employees, saveEmployees,
    submissions, saveSubs,
    departments, saveDepartments,
    websites, saveWebsites,
    targets, saveTargets,
    customFields, saveCustomFields,
    announcements, saveAnnouncements,
    messages, saveMessages,
    leaves, saveLeaves,
    salaries, saveSalaries,
    insertionOrders, saveIOs,
    logo, onLogoChange, onLogoRemove,
    adminPwd, setAdminPwd,
    toast, showToast,
    notifications, pushNotification,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within an AppDataProvider");
  return ctx;
}
