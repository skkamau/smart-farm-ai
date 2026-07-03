export default function PageHeader({ title, eyebrow, action }) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <div className="label">{eyebrow}</div>
        <h1 className="mt-1 text-2xl font-bold text-farm-950 sm:text-3xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}
