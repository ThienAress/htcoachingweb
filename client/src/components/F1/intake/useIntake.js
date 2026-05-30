import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getLatestIntake,
  saveIntakeDraft,
  submitIntake,
  createF1Media,
} from "../../../services/f1Customer.service";

export const useLatestIntake = (customerId) => {
  return useQuery({
    queryKey: ["f1-intake-latest", customerId],
    queryFn: () => getLatestIntake(customerId).then(res => res.data),
    enabled: !!customerId,
    retry: false,
  });
};

export const useSaveIntakeDraft = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ customerId, step, data }) => saveIntakeDraft(customerId, { step, data }),
    onSuccess: (res, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: ["f1-intake-latest", customerId] });
    },
  });
};

export const useSubmitIntake = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, data }) => submitIntake(customerId, data),
    onSuccess: (res, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: ["f1-intake-latest", customerId] });
      queryClient.invalidateQueries({ queryKey: ["f1-customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["f1-customers"] });
    },
  });
};

export const useUploadF1Media = () => {
  return useMutation({
    mutationFn: ({ customerId, file, type, intakeId }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);
      if (intakeId) form.append("intakeId", intakeId);
      return createF1Media(customerId, form);
    },
  });
};
