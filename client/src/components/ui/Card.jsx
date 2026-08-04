function Card({ children, className = "", ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }) {
  return <div className={`p-5 border-b border-gray-100 ${className}`}>{children}</div>;
}

export function CardBody({ children, className = "" }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }) {
  return <div className={`p-5 border-t border-gray-100 ${className}`}>{children}</div>;
}

export default Card;
