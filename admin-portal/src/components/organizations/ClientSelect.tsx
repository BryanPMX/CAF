"use client";
import { useEffect, useState } from "react";
import { Select } from "antd";
import { OrganizationService } from "@/services/organizationService";
import { clientLabel, type ClientOption } from "@/app/lib/organizations";
import { ORGANIZATION_TEXT as text } from "@/config/organizations";
export default function ClientSelect({
  value,
  onChange,
  officeId,
  clientType,
  multiple,
  initialClients = [],
  onSelected,
  id,
}: {
  value?: number | number[];
  onChange?: (value: number | number[]) => void;
  officeId?: number;
  clientType?: string;
  multiple?: boolean;
  id?: string;
  initialClients?: ClientOption[];
  onSelected?: (client: ClientOption | undefined) => void;
}) {
  const [retained, setRetained] = useState<ClientOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      OrganizationService.clients(search, officeId, clientType)
        .then((rows) => {
          if (!cancelled) setClients(rows);
        })
        .catch(() => {
          if (!cancelled) setClients([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, officeId, clientType]);
  const choices = [
    ...new Map(
      [...initialClients, ...retained, ...clients].map((client) => [client.id, client]),
    ).values(),
  ];
  return (
    <Select
      id={id}
      aria-label={id ? undefined : text.selectClient}
      mode={multiple ? "multiple" : undefined}
      value={value}
      onChange={(next) => {
        const selected = Array.isArray(next) ? next : [next];
        setRetained(choices.filter(client => selected.includes(client.id)));
        onChange?.(next);
        if (!multiple)
          onSelected?.(choices.find((client) => client.id === next));
      }}
      showSearch
      onSearch={setSearch}
      filterOption={false}
      loading={loading}
      allowClear
      placeholder={text.clientPlaceholder}
      options={choices.map((client) => ({
        value: client.id,
        label: clientLabel(client),
      }))}
    />
  );
}
