'use client';

import { useEffect, useMemo, useState } from 'react';
import { DatePicker, Form, Input, Modal, Select, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { CalendarEventPayload, CalendarStaffMember, EmployeeCalendarEvent } from '@/app/lib/calendar';
import { getRoleDisplayName } from '@/config/roles';
import { CalendarService } from '@/services/calendarService';

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

function getDefaultRange(date: Dayjs): [Dayjs, Dayjs] {
  const now = dayjs();
  const base = date.isSame(now, 'day') ? now.add(1, 'hour').startOf('hour') : date.hour(9).minute(0).second(0);
  return [base, base.add(1, 'hour')];
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
    form.setFieldsValue({ range: getDefaultRange(initialDate), attendeeIds: [] });
  }, [event, form, initialDate, open]);

  const handleSubmit = async (values: CalendarEventFormValues) => {
    setSubmitting(true);
    const payload: CalendarEventPayload = {
      title: values.title.trim(),
      description: values.description?.trim() || '',
      location: values.location?.trim() || '',
      startTime: values.range[0].toISOString(),
      endTime: values.range[1].toISOString(),
      attendeeIds: values.attendeeIds || [],
    };

    try {
      const saved = event
        ? await CalendarService.updateEvent(event.id, payload)
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
          rules={[
            { required: true, message: 'Seleccione el inicio y fin.' },
            {
              validator: async (_, value?: [Dayjs, Dayjs]) => {
                if (value && !value[1].isAfter(value[0])) {
                  throw new Error('La hora de fin debe ser posterior al inicio.');
                }
                if (value && value[1].diff(value[0], 'day', true) > 31) {
                  throw new Error('El evento no puede durar más de 31 días.');
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
