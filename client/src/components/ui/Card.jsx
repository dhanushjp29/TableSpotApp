function Card({ children, className = "", ...props }) {
  return (
    <div className={`card-theme ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }) {
  return <div className={`border-b border-border/80 bg-surface-secondary/35 p-5 ${className}`}>{children}</div>;
}

export function CardBody({ children, className = "" }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }) {
  return <div className={`border-t border-border/80 bg-surface-secondary/25 p-5 ${className}`}>{children}</div>;
}

export default Card;
