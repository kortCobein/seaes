export function ExcelIcon({ size = 26 }: { size?: number }) {
  return <img src={`${import.meta.env.BASE_URL}excel-glass.svg`} className="excel-file-icon"
    width={size} height={size} style={{ width: size, height: size }} alt="" aria-hidden="true" decoding="async" />;
}
