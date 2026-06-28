/**
 * ToastHost.jsx
 * ─────────────────────────────────────────────────────────────
 * Single shared toast renderer. Mounted once at the App root (above
 * the router), so a toast fired from either portal renders in the
 * same place with the same styling — without either portal needing
 * to duplicate the toast markup.
 */
import { useAppData } from "../../data/AppDataContext";

export default function ToastHost() {
  const { toast } = useAppData();
  if (!toast) return null;
  return <div className={`sv-toast sv-toast--${toast.kind}`}>{toast.msg}</div>;
}
