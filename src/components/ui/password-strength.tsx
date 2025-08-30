import React from 'react';
import { Check, X } from 'lucide-react';
import { PasswordStrengthResult, getPasswordStrengthLabel, getPasswordStrengthColor } from '@/lib/passwordValidation';

interface PasswordStrengthProps {
  result: PasswordStrengthResult;
  className?: string;
}

export function PasswordStrength({ result, className = '' }: PasswordStrengthProps) {
  if (!result || result.score === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Password strength</span>
          <span className="text-sm font-medium">
            {getPasswordStrengthLabel(result.score)}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor(result.score)}`}
            style={{ width: `${result.score}%` }}
          />
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="space-y-1">
        <RequirementItem 
          met={result.requirements.minLength} 
          text="At least 8 characters" 
        />
        <RequirementItem 
          met={result.requirements.hasUppercase} 
          text="One uppercase letter" 
        />
        <RequirementItem 
          met={result.requirements.hasLowercase} 
          text="One lowercase letter" 
        />
        <RequirementItem 
          met={result.requirements.hasNumber} 
          text="One number" 
        />
        <RequirementItem 
          met={result.requirements.hasSpecialChar} 
          text="One special character" 
        />
      </div>
    </div>
  );
}

interface RequirementItemProps {
  met: boolean;
  text: string;
}

function RequirementItem({ met, text }: RequirementItemProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {met ? (
        <Check className="w-3 h-3 text-green-500" />
      ) : (
        <X className="w-3 h-3 text-muted-foreground" />
      )}
      <span className={met ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}>
        {text}
      </span>
    </div>
  );
}