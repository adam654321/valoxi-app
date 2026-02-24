import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Bell, Check, CheckCheck, Users, Building2, UserPlus, UserCheck } from "lucide-react";

interface Notification {
  id: number;
  notificationType: string;
  notificationTitle: string;
  notificationMessage: string;
  isRead: boolean;
  createdAt: Date;
  targetCompanyName?: string;
  fromUserName?: string;
}

interface NotificationsProps {
  trigger?: React.ReactNode;
  showAsDialog?: boolean;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'team_invitation_sent':
      return <UserPlus className="h-4 w-4 text-blue-500" />;
    case 'team_member_joined':
      return <UserCheck className="h-4 w-4 text-green-500" />;
    case 'deal_assigned':
      return <Building2 className="h-4 w-4 text-purple-500" />;
    default:
      return <Bell className="h-4 w-4 text-gray-500" />;
  }
};

const getNotificationVariant = (type: string) => {
  switch (type) {
    case 'team_invitation_sent':
      return 'default';
    case 'team_member_joined':
      return 'default';
    case 'deal_assigned':
      return 'secondary';
    default:
      return 'outline';
  }
};

export function Notifications({ trigger, showAsDialog = false }: NotificationsProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  // Query notifications using v2 endpoint
  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ['/api/v2/notifications'],
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    select: (response: any) => response.data,
  });

  // Mark single notification as read
  const markReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await apiRequest('PUT', `/api/v2/notifications/${notificationId}/read`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/notifications'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error marking notification as read",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mark all notifications as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/v2/notifications/mark-all-read');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/notifications'] });
      const count = data.data?.count ?? data.count ?? 0;
      if (count > 0) {
        toast({
          title: "All notifications marked as read",
          description: `${count} notifications marked as read.`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error marking notifications as read",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const NotificationList = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Notifications
        </h3>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
        )}
      </div>

      <Separator />

      {/* Notifications List */}
      <ScrollArea className="h-[400px]">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 border rounded-lg animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : notifications && notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 border rounded-lg transition-colors ${
                  !notification.isRead 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                    : 'bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.notificationType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {notification.notificationTitle}
                      </h4>
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markReadMutation.mutate(notification.id)}
                          disabled={markReadMutation.isPending}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {notification.notificationMessage}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={getNotificationVariant(notification.notificationType)}
                          className="text-xs"
                        >
                          {notification.notificationType.replace(/_/g, ' ')}
                        </Badge>
                        {notification.targetCompanyName && (
                          <Badge variant="outline" className="text-xs">
                            {notification.targetCompanyName}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(notification.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {notification.fromUserName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        From: {notification.fromUserName}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No notifications yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              You'll see team updates and activity here
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="relative">
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  );

  if (showAsDialog) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {trigger || defaultTrigger}
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Team Notifications</DialogTitle>
            <DialogDescription>
              Stay updated with team activity and important updates
            </DialogDescription>
          </DialogHeader>
          <NotificationList />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <NotificationList />
      </PopoverContent>
    </Popover>
  );
}

export function NotificationsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Notifications</h1>
          <p className="text-gray-600 dark:text-gray-400">Stay updated with team activity and important updates</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Team notifications and updates from your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Notifications showAsDialog={false} />
        </CardContent>
      </Card>
    </div>
  );
}