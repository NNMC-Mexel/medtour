/**
 * Case-first chat routes.
 * Static/action routes live outside the core CRUD router.
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/support-chat/message',
      handler: 'conversation.supportMessage',
      info: { apiName: 'conversation', type: 'content-api' },
      config: { auth: false, policies: [] },
    },
    {
      method: 'GET',
      path: '/support-chat/:conversationId/messages',
      handler: 'conversation.supportMessages',
      info: { apiName: 'conversation', type: 'content-api' },
      config: { auth: false, policies: [] },
    },
    {
      method: 'GET',
      path: '/conversations/for-case/:caseId',
      handler: 'conversation.forCase',
      info: { apiName: 'conversation', type: 'content-api' },
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/conversations/:id/messages',
      handler: 'conversation.messages',
      info: { apiName: 'conversation', type: 'content-api' },
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/conversations/:id/read',
      handler: 'conversation.markRead',
      info: { apiName: 'conversation', type: 'content-api' },
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/conversations/:id/takeover',
      handler: 'conversation.takeover',
      info: { apiName: 'conversation', type: 'content-api' },
      config: { policies: [] },
    },
  ],
};
