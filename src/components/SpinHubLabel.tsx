/** Hub content in rotate mode (main menu and submenu). */
export function SpinHubLabel({ hubSize }: { hubSize: number }) {
  const icon = Math.round(hubSize * 0.2);
  return (
    <>
      <svg className="hub__spin-icon" width={icon} height={icon} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="hub__label hub__label--spin">ROTATE</span>
      <span className="hub__hint">drag to turn</span>
    </>
  );
}
