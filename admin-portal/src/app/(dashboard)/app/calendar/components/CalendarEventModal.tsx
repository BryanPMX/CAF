'use client';

import { useEffect, useMemo, useState } from 'react';
import { DatePicker, Form, Input, Modal, Select, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { CalendarEventPayload, CalendarStaffMember, EmployeeCalendarEvent } from '@/app/lib/calendar';
import { getRoleDisplayName } from '@/config/roles';
import { CalendarService } from '@/services/calendarService';
import { defaultInternalRange, schedulingHours, SCHEDULE_LABELS, withinSchedulingHours } from '@/app/lib/schedulingHours';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface CalendarEventFormValues {
  title: string;
  description?: string;
  location?: string;
  range: [Dayjs, Dayjs];
  attendeeIds?: number[];
}

interface CalendarEventModalProps {
  open: boolean;
  event: EmployeeCalendarEvent | null;
  staff: CalendarStaffMember[];
  currentUserId: number;
  initialDate: Dayjs;
  onCancel: () => void;
  onSaved: (event: EmployeeCalendarEvent) => void;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  return 'No fue posible guardar el evento.';
}

export default function CalendarEventModal({
  open,
  event,
  staff,
  currentUserId,
  initialDate,
  onCancel,
  onSaved,
}: CalendarEventModalProps) {
  const [form] = Form.useForm<CalendarEventFormValues>();
  const [submitting, setSubmitting] = useState(false);

  const staffOptions = useMemo(() => staff
    .filter((member) => member.id !== currentUserId)
    .map((member) => ({
      value: member.id,
      label: `${member.firstName} ${member.lastName} · ${getRoleDisplayName(member.role)}`,
      searchText: `${member.firstName} ${member.lastName} ${member.email} ${getRoleDisplayName(member.role)}`.toLowerCase(),
    })), [currentUserId, staff]);

  useEffect(() => {
    if (!open) return;
    if (event) {
      form.setFieldsValue({
        title: event.title,
        description: event.description,
        location: event.location,
        range: [dayjs(event.startTime), dayjs(event.endTime)],
        attendeeIds: event.attendees
          .map((attendee) => attendee.userId)
          .filter((userId) => userId !== event.organizerId),
      });
      return;
    }
    form.resetFields();
    form.setFieldsValue({ range: defaultInternalRange(initialDate), attendeeIds: [] });
  }, [event, form, initialDate, open]);

  const handleSubmit = async (values: CalendarEventFormValues) => {
    setSubmitting(true);
    const payload: CalendarEventPayload = {
      title: values.title.trim(),
      description: values.description?.trim() || '',
      location: values.location?.trim() || '',
      startTime: values.range[0].toISOString(),
      endTime: values.range[1].toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      attendeeIds: values.attendeeIds || [],
    };

    try {
      const timesUnchanged = event && dayjs(event.startTime).isSame(values.range[0]) && dayjs(event.endTime).isSame(values.range[1]);
      const updatePayload: Partial<CalendarEventPayload> = { ...payload };
      if (timesUnchanged) {
        delete updatePayload.startTime;
        delete updatePayload.endTime;
      }
      const saved = event
        ? await CalendarService.updateEvent(event.id, updatePayload)
        : await CalendarService.createEvent(payload);
      message.success(event ? 'Evento actualizado.' : 'Evento creado e invitaciones enviadas.');
      onSaved(saved);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={event ? 'Editar evento' : 'Nuevo evento interno'}
      okText={event ? 'Guardar cambios' : 'Crear evento'}
      cancelText="Cancelar"
      confirmLoading={submitting}
      destroyOnHidden
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={(values) => void handleSubmit(values)} className="pt-3">
        <Form.Item
          name="title"
          label="Título"
          rules={[
            { required: true, message: 'Ingrese un título.' },
            { min: 3, max: 200, message: 'Use entre 3 y 200 caracteres.' },
          ]}
        >
          <Input maxLength={200} showCount placeholder="Ej. Revisión semanal del equipo" />
        </Form.Item>

        <Form.Item
          name="range"
          label="Fecha y hora"
          extra={`${SCHEDULE_LABELS.internal}. Zona horaria: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
          rules={[
            { required: true, message: 'Seleccione el inicio y fin.' },
            {
              validator: async (_, value?: [Dayjs, Dayjs]) => {
                if (event && value && dayjs(event.startTime).isSame(value[0]) && dayjs(event.endTime).isSame(value[1])) return;
                if (value && !value[1].isAfter(value[0])) {
                  throw new Error('La hora de fin debe ser posterior al inicio.');
                }
                if (value && !withinSchedulingHours(value[0], value[1], 'internal')) {
                  throw new Error(`Seleccione inicio y fin el mismo día. ${SCHEDULE_LABELS.internal}.`);
                }
              },
            },
          ]}
        >
          <RangePicker
            showTime={{ format: 'HH:mm' }}
            format="DD/MM/YYYY HH:mm"
            className="w-full"
            minuteStep={15}
            disabledDate={(date) => date.day() === 0}
            disabledTime={(date, type) => {
              const hours = date && schedulingHours(date, 'internal');
              return {
                disabledHours: () => Array.from({ length: 24 }, (_, hour) => hour).filter((hour) => !hours || hour < hours.open || hour > hours.close || (type === 'start' && hour === hours.close)),
                disabledMinutes: (hour) => hours && hour === hours.close ? Array.from({ length: 59 }, (_, minute) => minute + 1) : [],
                disabledSeconds: () => Array.from({ length: 59 }, (_, second) => second + 1),
              };
            }}
          />
        </Form.Item>

        <Form.Item name="attendeeIds" label="Invitar personal">
          <Select
            mode="multiple"
            allowClear
            showSearch
            maxCount={50}
            placeholder="Seleccione participantes"
            options={staffOptions}
            optionFilterProp="searchText"
          />
        </Form.Item>

        <Form.Item name="location" label="Ubicación">
          <Input maxLength={255} placeholder="Sala, oficina o enlace de videollamada" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Notas"
          rules={[{ max: 2000, message: 'Las notas no pueden exceder 2000 caracteres.' }]}
        >
          <TextArea rows={3} maxLength={2000} showCount placeholder="Objetivo o información necesaria para la reunión" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
