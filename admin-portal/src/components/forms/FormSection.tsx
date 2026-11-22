import type { ReactNode } from 'react';
import styles from './FormSection.module.css';

/** A named field group with the same spacing and hierarchy in every form. */
export default function FormSection({
  title,
  description,
  optional = false,
  children,
}: {
  title: string;
  description?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>
        {title}
        {optional && <span className={styles.optional}>Opcional</span>}
      </legend>
      {description && <p className={styles.description}>{description}</p>}
      {children}
    </fieldset>
  );
}
