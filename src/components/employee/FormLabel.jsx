/**
 * FormLabel — small reusable label used above every form input
 * across the Employee DSR form, leave form, and admin settings forms.
 */
export default function FormLabel({ text }) {
  return <label className="sv-label">{text}</label>;
}
