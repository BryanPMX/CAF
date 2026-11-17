import type { ReactNode } from "react";
import { PROFILE_TEXT as text } from "@/config/profile";
import styles from "./ProfileLayout.module.css";

export default function ProfileLayout({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{text.description}</p>
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
