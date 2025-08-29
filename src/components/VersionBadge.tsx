import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatVersionDisplay, getVersionMeta } from '@/lib/version';
import { ExternalLink } from 'lucide-react';

export function VersionBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const versionMeta = getVersionMeta();
  const displayText = formatVersionDisplay();

  const buildDate = new Date(versionMeta.buildTime);
  const formattedBuildTime = buildDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Badge 
          variant="secondary" 
          className="text-xs px-2 py-1 opacity-80 hover:opacity-100 transition-opacity cursor-pointer font-mono"
          style={{ fontSize: '11px' }}
        >
          {displayText}
        </Badge>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Version Information
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="font-medium text-muted-foreground">App</div>
              <div className="font-mono">{versionMeta.name}</div>
            </div>
            <div>
              <div className="font-medium text-muted-foreground">Version</div>
              <div className="font-mono">{versionMeta.version}</div>
            </div>
            <div>
              <div className="font-medium text-muted-foreground">Branch</div>
              <div className="font-mono">{versionMeta.branch}</div>
            </div>
            <div>
              <div className="font-medium text-muted-foreground">Environment</div>
              <div className="font-mono">{versionMeta.env}</div>
            </div>
          </div>
          
          <div className="border-t pt-3">
            <div className="font-medium text-muted-foreground mb-2">Build Details</div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Full SHA:</span>
                <div className="font-mono text-xs break-all">{versionMeta.commit}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Build Time:</span>
                <div className="font-mono text-xs">{formattedBuildTime}</div>
              </div>
              {versionMeta.buildId && (
                <div>
                  <span className="text-muted-foreground">Build ID:</span>
                  <div className="font-mono text-xs">{versionMeta.buildId}</div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-3">
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href="/api/version" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                View JSON
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}