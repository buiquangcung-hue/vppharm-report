export const ROLES = {
  PENDING: "pending",
  USER: "user",
  DIRECTOR: "director",
  ADMIN: "admin",
};

export const STATUSES = {
  PENDING: "pending",
  ACTIVE: "active",
  BLOCKED: "blocked",
};

export function isAdmin(profile) {
  return profile?.role === ROLES.ADMIN;
}

export function isDirector(profile) {
  return profile?.role === ROLES.DIRECTOR;
}

export function isUser(profile) {
  return profile?.role === ROLES.USER;
}

export function isPending(profile) {
  return profile?.role === ROLES.PENDING;
}

export function isApproved(profile) {
  return Boolean(profile?.approved) && !Boolean(profile?.blocked);
}

export function canAccessAdmin(profile) {
  return isAdmin(profile);
}

export function canCreateWeeklyReport(profile) {
  return isAdmin(profile) || isDirector(profile);
}

export function canViewOwnReports(profile) {
  return isAdmin(profile) || isDirector(profile) || isUser(profile);
}

export function getReadableRole(role) {
  switch (role) {
    case ROLES.ADMIN:
      return "Admin";
    case ROLES.DIRECTOR:
      return "Giám đốc kinh doanh";
    case ROLES.USER:
      return "Nhân viên";
    case ROLES.PENDING:
      return "Chờ duyệt";
    default:
      return "Không xác định";
  }
}

export function getReadableStatus(status) {
  switch (status) {
    case STATUSES.ACTIVE:
      return "Đang hoạt động";
    case STATUSES.PENDING:
      return "Chờ duyệt";
    case STATUSES.BLOCKED:
      return "Đã khóa";
    default:
      return "Không xác định";
  }
}