"use client";
import { useEffect, useState } from "react";
import { Alert, Form, Input, Modal, Select } from "antd";
import { useAuth } from "@/context/AuthContext";
import { ORGANIZATION_TEXT as text } from "@/config/organizations";
import type { ClientOption } from "@/app/lib/organizations";
import { WorkflowService, type WorkflowUser } from "@/services/workflowService";
import {
  availableAppointmentSlots,
  loadEmployeeAvailability,
  type AppointmentSlot,
} from "@/services/appointmentAvailability";
import AppointmentAvailabilityPicker from "@/app/(dashboard)/components/AppointmentAvailabilityPicker";
import { CalendarService } from "@/services/calendarService";
import ClientSelect from "./ClientSelect";
export default function DirectClientAppointmentModal({
  open,
  initialClient,
  onClose,
  onSaved,
}: {
  open: boolean;
  initialClient?: ClientOption;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [client, setClient] = useState<ClientOption | undefined>(initialClient);
  const [staff, setStaff] = useState<WorkflowUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const staffId = Form.useWatch("staffId", form);
  useEffect(() => {
    if (!open || !user) return;
    setError(null);
    setClient(initialClient);
    form.resetFields();
    form.setFieldValue("clientId", initialClient?.id);
    let current = true;
    CalendarService.listStaff()
      .then((rows) => {
        if (current) setStaff(rows);
      })
      .catch(() => setError(text.failed));
    return () => {
      current = false;
    };
  }, [open, user, initialClient, form]);
  const save = async () => {
    try {
      const values = await form.validateFields();
      if (!user || !client?.officeId) return;
      setSaving(true);
      setError(null);
      const schedule = values.schedule as AppointmentSlot;
      const busy = await loadEmployeeAvailability(
        values.staffId,
        schedule.startTime.startOf("day"),
        schedule.startTime.add(1, "day").startOf("day"),
      );
      if (
        !availableAppointmentSlots(
          schedule.startTime,
          schedule.endTime.diff(schedule.startTime, "minute"),
          busy,
        ).some((slot) => slot.valueOf() === schedule.startTime.valueOf())
      )
        throw new Error(text.unavailableSchedule);
      await WorkflowService.createAppointment(user.role, {
        withoutCase: true,
        clientId: client.id,
        officeId: client.officeId,
        staffId: values.staffId,
        title: values.title,
        startTime: schedule.startTime.toISOString(),
        endTime: schedule.endTime.toISOString(),
        timeZone: schedule.timeZone,
        status: "confirmed",
        department: "General",
        category: "General",
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      if (e && typeof e === "object" && "errorFields" in e) return;
      const failure = e as {
        message?: string;
        response?: { data?: { error?: string } };
      };
      setError(failure.response?.data?.error || failure.message || text.failed);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={text.directAppointment}
      open={open}
      onCancel={onClose}
      onOk={save}
      okText={text.save}
      cancelText={text.cancel}
      confirmLoading={saving}
      width={760}
      destroyOnClose
    >
      <p className="mb-4 text-sm text-slate-500">{text.directHint}</p>
      {error && (
        <Alert type="error" showIcon message={error} className="mb-4" />
      )}
      <Form form={form} layout="vertical">
        <Form.Item
          name="clientId"
          label={text.constructora.singular}
          rules={[{ required: true, message: text.required }]}
        >
          <ClientSelect
            clientType="organization"
            initialClients={initialClient ? [initialClient] : []}
            onSelected={(selected) => {
              setClient(selected);
              form.setFieldsValue({ staffId: undefined, schedule: undefined });
            }}
          />
        </Form.Item>
        <Form.Item
          name="title"
          label={text.appointmentTitle}
          rules={[{ required: true, message: text.required }]}
        >
          <Input maxLength={255} />
        </Form.Item>
        <Form.Item
          name="staffId"
          label={text.assignTo}
          rules={[{ required: true, message: text.required }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            disabled={!client}
            options={staff
              .filter((member) => member.officeId === client?.officeId)
              .map((member) => ({
                value: member.id,
                label: `${member.firstName} ${member.lastName}`,
              }))}
            onChange={() => form.setFieldValue("schedule", undefined)}
          />
        </Form.Item>
        <Form.Item
          name="schedule"
          label={text.appointmentSchedule}
          rules={[{ required: true, message: text.required }]}
        >
          <AppointmentAvailabilityPicker
            key={staffId || "none"}
            staffId={staffId}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
