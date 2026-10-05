/**
 * PUT /doctors/:id/schedule — the doctor's schedule only. Role grants live in
 * src/index.ts; the controller additionally limits doctors to their own card.
 */
export default {
  routes: [
    {
      method: 'PUT',
      path: '/doctors/:id/schedule',
      handler: 'doctor.updateSchedule',
      config: { policies: [] },
    },
  ],
};
