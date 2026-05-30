import { prisma } from './db';

type NotificationType = 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';

interface NotifyAdminParams {
  adminId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}

export async function notifyAdmin({ adminId, title, message, type = 'INFO', link }: NotifyAdminParams) {
  try {
    return await prisma.notification.create({
      data: {
        adminId,
        title,
        message,
        type,
        link,
      },
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

export async function notifyAllAdmins({ title, message, type = 'INFO', link }: Omit<NotifyAdminParams, 'adminId'>) {
  try {
    const admins = await prisma.adminUser.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const notifications = admins.map(admin => ({
      adminId: admin.id,
      title,
      message,
      type,
      link,
    }));

    return await prisma.notification.createMany({
      data: notifications,
    });
  } catch (error) {
    console.error('Failed to create global notification:', error);
    return null;
  }
}
