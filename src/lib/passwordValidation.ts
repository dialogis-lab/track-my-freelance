export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0-100
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
  suggestions: string[];
}

export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const requirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const suggestions: string[] = [];
  let score = 0;

  // Check requirements and add suggestions
  if (!requirements.minLength) {
    suggestions.push('Use at least 8 characters');
  } else {
    score += 20;
  }

  if (!requirements.hasUppercase) {
    suggestions.push('Add at least one uppercase letter');
  } else {
    score += 20;
  }

  if (!requirements.hasLowercase) {
    suggestions.push('Add at least one lowercase letter');
  } else {
    score += 20;
  }

  if (!requirements.hasNumber) {
    suggestions.push('Include at least one number');
  } else {
    score += 20;
  }

  if (!requirements.hasSpecialChar) {
    suggestions.push('Include at least one special character (!@#$%^&*)');
  } else {
    score += 20;
  }

  // Bonus points for longer passwords
  if (password.length >= 12) {
    score += 10;
  }
  if (password.length >= 16) {
    score += 10;
  }

  const isValid = Object.values(requirements).every(req => req);

  return {
    isValid,
    score: Math.min(score, 100),
    requirements,
    suggestions,
  };
}

export function getPasswordStrengthLabel(score: number): string {
  if (score < 40) return 'Weak';
  if (score < 70) return 'Fair';
  if (score < 90) return 'Good';
  return 'Strong';
}

export function getPasswordStrengthColor(score: number): string {
  if (score < 40) return 'bg-red-500';
  if (score < 70) return 'bg-yellow-500';
  if (score < 90) return 'bg-blue-500';
  return 'bg-green-500';
}