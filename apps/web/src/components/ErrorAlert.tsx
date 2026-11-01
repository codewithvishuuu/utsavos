import { useEffect, useRef, type ReactNode } from "react";

type ErrorAlertProps = {
  message: string;
  className?: string;
  icon?: ReactNode;
};

/** Keeps an error visible even when the action that failed is far down the page. */
export function ErrorAlert({ message, className, icon }: ErrorAlertProps) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!message || !node) return;
    const bounds = node.getBoundingClientRect();
    if (bounds.top < 72 || bounds.bottom > window.innerHeight) {
      node.scrollIntoView?.({ block: "center" });
    }
    // Alerts are announced, but focus also keeps keyboard users at the failure.
    node.focus({ preventScroll: true });
  }, [message]);

  if (!message) return null;

  return (
    <p
      ref={ref}
      tabIndex={-1}
      role="alert"
      className={`focus:outline-none ${className ?? "mt-3 text-sm font-medium text-[#A84422]"}`}
    >
      {icon}
      {message}
    </p>
  );
}
