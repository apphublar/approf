export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  badge,
}: {
  eyebrow: string
  title: string
  description?: string
  action?: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <header className="page-header-v2">
      <div>
        <p className="page-eyebrow">{eyebrow}</p>
        <h1 className="page-title-v2">
          {title}
          {badge}
        </h1>
        {description ? <p className="page-description-v2">{description}</p> : null}
      </div>
      {action}
    </header>
  )
}
