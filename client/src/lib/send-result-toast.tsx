import { ToastAction } from '@/components/ui/toast';

export interface SendResult {
  success: boolean;
  sentVia: 'nylas' | 'resend';
  fromEmail: string;
  replyToEmail: string | null;
}

type ToastFn = (opts: any) => void;

/**
 * Surfaces the post-send banner per D25.11.
 * Reads sendResult from either response shape:
 *   - wrapped via sendSuccess/sendCreated: data.data.sendResult
 *   - bare res.json(): data.sendResult
 * Emits a Nylas success toast with the From address,
 * or a Resend fallback toast with the connect-email banner.
 */
export function handleSendResult(
  data: any,
  toast: ToastFn,
  successContext: string,
  nylasConnectVisible = false,
): void {
  const result: SendResult | null =
    data?.data?.sendResult ?? data?.sendResult ?? null;

  if (!result) {
    toast({ title: successContext });
    return;
  }

  if (result.sentVia === 'nylas') {
    toast({
      title: successContext,
      description: `Sent from ${result.fromEmail}`,
    });
    return;
  }

  if (!nylasConnectVisible) {
    toast({ title: successContext });
    return;
  }

  toast({
    title: successContext,
    description:
      'Sent as system email. Connect your email to send personalised.',
    duration: 8000,
    action: (
      <ToastAction
        altText="Connect email"
        onClick={() => {
          window.location.href = '/account';
        }}
      >
        Connect email
      </ToastAction>
    ),
  });
}
