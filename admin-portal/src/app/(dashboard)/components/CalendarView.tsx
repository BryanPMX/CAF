'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Card, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  DatePicker, 
  TimePicker, 
  message, 
  Tag, 
  Space, 
  Tooltip, 
  Badge,
  Dropdown,
  Menu,
  Divider,
  Switch,
  Alert,
  Row,
  Col,
  Statistic,
  Progress
} from 'antd';
import {
  PlusOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FilterOutlined,
  ExportOutlined,
  ImportOutlined,
  ReloadOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined as PendingIcon
} from '@ant-design/icons';
import { apiClient } from '../../lib/api';
import dayjs, { Dayjs } from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface Appointment {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: 'consultation' | 'follow-up' | 'emergency' | 'routine';
  officeId: string;
  officeName: string;
  assignedTo: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface CalendarViewProps {
  onAppointmentSelect?: (appointment: Appointment) => void;
  onAppointmentCreate?: () => void;
  onAppointmentEdit?: (appointment: Appointment) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  onAppointmentSelect,
  onAppointmentCreate,
  onAppointmentEdit
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    status: [],
    priority: [],
    type: [],
    office: [],
    assignedTo: []
  });
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  useEffect(() => {
    fetchAppointments();
  }, [filters]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/appointments', { params: filters });
      setAppointments(response.data);
    } catch (error) {
      message.error('Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date: Dayjs) => {
    setSelectedAppointment(null);
    setModalVisible(true);
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setModalVisible(true);
    onAppointmentSelect?.(appointment);
  };

  const handleCreateAppointment = async (values: any) => {
    try {
      const appointmentData = {
        ...values,
        startTime: values.startTime.format('YYYY-MM-DD HH:mm:ss'),
        endTime: values.endTime.format('YYYY-MM-DD HH:mm:ss')
      };

      if (selectedAppointment) {
        await apiClient.patch(`/admin/appointments/${selectedAppointment.id}`, appointmentData);
        message.success('Appointment updated successfully');
      } else {
        await apiClient.post('/admin/appointments', appointmentData);
        message.success('Appointment created successfully');
      }

      setModalVisible(false);
      setSelectedAppointment(null);
      fetchAppointments();
      onAppointmentCreate?.();
    } catch (error) {
      message.error('Failed to save appointment');
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      await apiClient.delete(`/admin/appointments/${id}`);
      message.success('Appointment deleted successfully');
      fetchAppointments();
    } catch (error) {
      message.error('Failed to delete appointment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'scheduled': return 'processing';
      case 'completed': return 'default';
      case 'cancelled': return 'error';
      case 'no-show': return 'warning';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'blue';
      case 'low': return 'green';
      default: return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'consultation': return <UserOutlined />;
      case 'follow-up': return <ClockCircleOutlined />;
      case 'emergency': return <ExclamationCircleOutlined />;
      case 'routine': return <CheckCircleOutlined />;
      default: return <CalendarOutlined />;
    }
  };

  const dateCellRender = (date: Dayjs) => {
    const dayAppointments = appointments.filter(apt => 
      dayjs(apt.startTime).isSame(date, 'day')
    );

    return (
      <div className="calendar-day-cell">
        {dayAppointments.map(appointment => (
          <Tooltip
            key={appointment.id}
            title={`${appointment.title} - ${appointment.clientName}`}
          >
            <div
              className={`calendar-appointment-item cursor-pointer p-1 mb-1 rounded text-xs ${
                appointment.priority === 'urgent' ? 'bg-red-100 border-l-4 border-red-500' :
                appointment.priority === 'high' ? 'bg-orange-100 border-l-4 border-orange-500' :
                appointment.priority === 'medium' ? 'bg-blue-100 border-l-4 border-blue-500' :
                'bg-green-100 border-l-4 border-green-500'
              }`}
              onClick={() => handleAppointmentClick(appointment)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{appointment.title}</span>
                <Tag color={getStatusColor(appointment.status)}>
                  {appointment.status}
                </Tag>
              </div>
              <div className="text-gray-600 truncate">{appointment.clientName}</div>
              <div className="text-gray-500 text-xs">
                {dayjs(appointment.startTime).format('HH:mm')} - {dayjs(appointment.endTime).format('HH:mm')}
              </div>
            </div>
          </Tooltip>
        ))}
      </div>
    );
  };

  const monthCellRender = (date: Dayjs) => {
    const dayAppointments = appointments.filter(apt => 
      dayjs(apt.startTime).isSame(date, 'day')
    );

    if (dayAppointments.length === 0) return null;

    return (
      <div className="calendar-month-cell">
        <div className="text-xs text-gray-600 mb-1">
          {dayAppointments.length} appointment{dayAppointments.length > 1 ? 's' : ''}
        </div>
        {dayAppointments.slice(0, 2).map(appointment => (
          <div
            key={appointment.id}
            className={`w-full h-1 mb-1 rounded ${
              appointment.priority === 'urgent' ? 'bg-red-500' :
              appointment.priority === 'high' ? 'bg-orange-500' :
              appointment.priority === 'medium' ? 'bg-blue-500' :
              'bg-green-500'
            }`}
          />
        ))}
        {dayAppointments.length > 2 && (
          <div className="text-xs text-gray-500">+{dayAppointments.length - 2} more</div>
        )}
      </div>
    );
  };

  return (
    <div className="calendar-view">
      {/* Header */}
      <Card className="mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Appointment Calendar</h2>
            <p className="text-gray-600">Manage and schedule appointments</p>
          </div>
          <Space>
            <Button 
              icon={<FilterOutlined />}
              onClick={() => setFilterModalVisible(true)}
            >
              Filters
            </Button>
            <Button 
              icon={<ExportOutlined />}
            >
              Export
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => {
                setSelectedAppointment(null);
                setModalVisible(true);
              }}
            >
              New Appointment
            </Button>
          </Space>
        </div>
      </Card>

      {/* Calendar Stats */}
      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Appointments"
              value={appointments.length}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Today"
              value={appointments.filter(apt => dayjs(apt.startTime).isSame(dayjs(), 'day')).length}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pending"
              value={appointments.filter(apt => apt.status === 'scheduled').length}
              prefix={<PendingIcon />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Completed"
              value={appointments.filter(apt => apt.status === 'completed').length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Calendar */}
      <Card>
        <Calendar
          dateCellRender={dateCellRender}
          monthCellRender={monthCellRender}
          onSelect={handleDateSelect}
          headerRender={({ value, onChange }) => (
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-4">
                <Button.Group>
                  <Button 
                    type={viewMode === 'month' ? 'primary' : 'default'}
                    onClick={() => setViewMode('month')}
                  >
                    Month
                  </Button>
                  <Button 
                    type={viewMode === 'week' ? 'primary' : 'default'}
                    onClick={() => setViewMode('week')}
                  >
                    Week
                  </Button>
                  <Button 
                    type={viewMode === 'day' ? 'primary' : 'default'}
                    onClick={() => setViewMode('day')}
                  >
                    Day
                  </Button>
                </Button.Group>
                <Button 
                  icon={<ReloadOutlined />}
                  onClick={fetchAppointments}
                >
                  Refresh
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Button onClick={() => onChange(value.clone().subtract(1, 'month'))}>
                  Previous
                </Button>
                <Button onClick={() => onChange(dayjs())}>
                  Today
                </Button>
                <Button onClick={() => onChange(value.clone().add(1, 'month'))}>
                  Next
                </Button>
              </div>
            </div>
          )}
        />
      </Card>

      {/* Appointment Modal */}
      <Modal
        title={selectedAppointment ? 'Edit Appointment' : 'New Appointment'}
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedAppointment(null);
        }}
        footer={null}
        width={700}
      >
        <Form
          layout="vertical"
          initialValues={selectedAppointment ? {
            ...selectedAppointment,
            startTime: dayjs(selectedAppointment.startTime),
            endTime: dayjs(selectedAppointment.endTime)
          } : {}}
          onFinish={handleCreateAppointment}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="title"
                label="Title"
                rules={[{ required: true, message: 'Please enter appointment title' }]}
              >
                <Input placeholder="Appointment title" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label="Type"
                rules={[{ required: true, message: 'Please select appointment type' }]}
              >
                <Select placeholder="Select type">
                  <Option value="consultation">Consultation</Option>
                  <Option value="follow-up">Follow-up</Option>
                  <Option value="emergency">Emergency</Option>
                  <Option value="routine">Routine</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startTime"
                label="Start Time"
                rules={[{ required: true, message: 'Please select start time' }]}
              >
                <DatePicker 
                  showTime 
                  format="YYYY-MM-DD HH:mm:ss"
                  className="w-full"
                  placeholder="Select start time"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endTime"
                label="End Time"
                rules={[{ required: true, message: 'Please select end time' }]}
              >
                <DatePicker 
                  showTime 
                  format="YYYY-MM-DD HH:mm:ss"
                  className="w-full"
                  placeholder="Select end time"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="clientName"
                label="Client Name"
                rules={[{ required: true, message: 'Please enter client name' }]}
              >
                <Input placeholder="Client name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="Priority"
                rules={[{ required: true, message: 'Please select priority' }]}
              >
                <Select placeholder="Select priority">
                  <Option value="low">Low</Option>
                  <Option value="medium">Medium</Option>
                  <Option value="high">High</Option>
                  <Option value="urgent">Urgent</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="clientEmail"
                label="Client Email"
                rules={[
                  { required: true, message: 'Please enter client email' },
                  { type: 'email', message: 'Please enter valid email' }
                ]}
              >
                <Input placeholder="Client email" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="clientPhone"
                label="Client Phone"
              >
                <Input placeholder="Client phone" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea rows={3} placeholder="Appointment description" />
          </Form.Item>

          <Form.Item
            name="notes"
            label="Notes"
          >
            <TextArea rows={2} placeholder="Additional notes" />
          </Form.Item>

          <div className="flex justify-end space-x-2">
            {selectedAppointment && (
              <Button 
                danger 
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteAppointment(selectedAppointment.id)}
              >
                Delete
              </Button>
            )}
            <Button onClick={() => setModalVisible(false)}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit">
              {selectedAppointment ? 'Update' : 'Create'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Filter Modal */}
      <Modal
        title="Filter Appointments"
        visible={filterModalVisible}
        onCancel={() => setFilterModalVisible(false)}
        onOk={() => {
          setFilterModalVisible(false);
          fetchAppointments();
        }}
        width={500}
      >
        <Form layout="vertical" initialValues={filters}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="Status">
                <Select mode="multiple" placeholder="Select statuses">
                  <Option value="scheduled">Scheduled</Option>
                  <Option value="confirmed">Confirmed</Option>
                  <Option value="completed">Completed</Option>
                  <Option value="cancelled">Cancelled</Option>
                  <Option value="no-show">No Show</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Priority">
                <Select mode="multiple" placeholder="Select priorities">
                  <Option value="low">Low</Option>
                  <Option value="medium">Medium</Option>
                  <Option value="high">High</Option>
                  <Option value="urgent">Urgent</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Type">
                <Select mode="multiple" placeholder="Select types">
                  <Option value="consultation">Consultation</Option>
                  <Option value="follow-up">Follow-up</Option>
                  <Option value="emergency">Emergency</Option>
                  <Option value="routine">Routine</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="office" label="Office">
                <Select mode="multiple" placeholder="Select offices">
                  {/* Office options would be populated from API */}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default CalendarView;
