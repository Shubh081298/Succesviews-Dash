/**
 * Barrel file — lets other modules do `import { KPI, Avatar, ... } from "../ui"`
 * instead of importing each file individually.
 */
export { default as KPI } from "./KPI.jsx";
export { default as Avatar } from "./Avatar.jsx";
export { default as ClickCard } from "./ClickCard.jsx";
export { default as DetailModal } from "./DetailModal.jsx";
export { default as ViewModal } from "./ViewModal.jsx";
