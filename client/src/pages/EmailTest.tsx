import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function EmailTest() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const testEmailConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      setTestResult(result);
      
      if (result.success) {
        toast({
          title: "Email Connection Successful",
          description: "SMTP configuration is working correctly.",
        });
      } else {
        toast({
          title: "Email Connection Failed",
          description: result.message || "Failed to connect to email server.",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorResult = { success: false, message: "Network error occurred" };
      setTestResult(errorResult);
      toast({
        title: "Test Failed",
        description: "Unable to test email connection.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-6 h-6" />
              Email Configuration Test
            </CardTitle>
            <CardDescription>
              Test your SMTP email configuration to ensure invitations and notifications are working.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <p><strong>Configuration Status:</strong></p>
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-blue-800 dark:text-blue-200">
                  SMTP configuration is managed securely on the server. Use the test button below to verify your email settings are working correctly.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center space-y-4">
              <Button 
                onClick={testEmailConnection}
                disabled={testing}
                className="w-full max-w-xs"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Test Email Connection
                  </>
                )}
              </Button>
              
              {testResult && (
                <div className={`flex items-center gap-2 p-4 rounded-lg border w-full ${
                  testResult.success 
                    ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200'
                    : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
                }`}>
                  {testResult.success ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  <div>
                    <p className="font-medium">
                      {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                    </p>
                    <p className="text-sm opacity-90">
                      {testResult.message}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-6">
              <h4 className="font-medium mb-3">Email Features Enabled:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span className="text-sm">Team Invitations</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Mail className="w-4 h-4 text-green-600" />
                  <span className="text-sm">Portal Access Links</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Mail className="w-4 h-4 text-orange-600" />
                  <span className="text-sm">Document Notifications</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Mail className="w-4 h-4 text-purple-600" />
                  <span className="text-sm">Deal Updates</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Troubleshooting Tips:
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Ensure your Google Workspace app password is correct</li>
                <li>• Check that 2-factor authentication is enabled</li>
                <li>• Verify your alias email is properly configured</li>
                <li>• Make sure less secure app access is disabled (use app passwords)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}