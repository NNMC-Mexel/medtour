export default async (policyContext) => {
  const user = policyContext.state?.user;
  return Boolean(user && ['admin', 'manager', 'coordinator'].includes(user.role?.type || user.userRole));
};
