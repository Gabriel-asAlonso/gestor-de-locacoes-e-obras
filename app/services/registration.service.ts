import { apiClient } from './auth.service';
import type { RegistrationInput } from './api-client';

export const registrationService = {
  request: (input: RegistrationInput) => apiClient.register(input),
};
