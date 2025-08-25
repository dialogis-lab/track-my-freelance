import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Download, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RecoveryCodesListProps {
  codes: string[];
  onClose: () => void;
}

export function RecoveryCodesList({ codes, onClose }: RecoveryCodesListProps) {
  const { toast } = useToast();

  const handleCopy = () => {
    const codesText = codes.join('\n');
    navigator.clipboard.writeText(codesText);
    toast({
      title: "Copied",
      description: "Recovery codes copied to clipboard.",
    });
  };

  const handleDownload = () => {
    const codesText = `TimeHatch Recovery Codes\n\nGenerated: ${new Date().toLocaleString('en-US')}\n\n${codes.join('\n')}\n\nKeep these codes secure. Each code can only be used once.`;
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timehatch-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded",
      description: "Recovery codes saved to your device.",
    });
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          <strong>Important:</strong> Keep your recovery codes in a secure place. Each code can be used once to access your account if you lose your authenticator device.
        </AlertDescription>
      </Alert>

      <div className="bg-muted p-4 rounded-lg">
        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
          {codes.map((code, index) => (
            <div key={index} className="p-2 bg-background rounded border">
              {code}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleCopy} variant="outline" className="flex-1">
          <Copy className="w-4 h-4 mr-2" />
          Copy Codes
        </Button>
        <Button onClick={handleDownload} variant="outline" className="flex-1">
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
      </div>

      <Button onClick={onClose} className="w-full">
        I've Saved My Recovery Codes
      </Button>
    </div>
  );
}