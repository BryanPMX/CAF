// marketing/src/routes/eventos/+page.server.js (NEW FILE)
/**
 * This loader function simulates fetching upcoming events from the Go API.
 * In the future, the Event Coordinator will manage this data from the Admin Portal.
 */
export async function load() {
    const events = [
      {
        date: { day: '15', month: 'JUL', year: '2025' },
        title: 'Taller de Finanzas Familiares',
        timeAndLocation: '6:00 PM - 7:30 PM @ Oficina Central',
        description: 'Aprenda a crear un presupuesto familiar, establecer metas de ahorro y manejar deudas de manera efectiva. Un taller práctico para tomar el control de su futuro financiero.'
      },
      {
        date: { day: '28', month: 'JUL', year: '2025' },
        title: 'Plática sobre Crianza Positiva',
        timeAndLocation: '10:00 AM - 11:30 AM @ Centro Comunitario del Este',
        description: 'Descubra técnicas y estrategias de comunicación para fomentar un ambiente de respeto y confianza con sus hijos. Abierto a todos los padres y cuidadores.'
      },
      {
        date: { day: '05', month: 'AGO', year: '2025' },
        title: 'Feria de Recursos Comunitarios',
        timeAndLocation: '12:00 PM - 4:00 PM @ Parque Central',
        description: 'Conéctese con diversas organizaciones locales que ofrecen servicios de salud, educación y empleo. Un evento para toda la familia con actividades para niños.'
      }
    ];
  
    return {
      events
    };
  }