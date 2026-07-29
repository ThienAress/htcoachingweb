import {
  getTrainerClientOverview as getCanonicalTrainerClientOverview,
} from "./trainerOverview.service.js";

export const getTrainerClientOverview = async ({
  actor,
  clientId,
  dateKey,
  days,
}) => {
  const data = await getCanonicalTrainerClientOverview({
    actor,
    clientId,
    dateKey,
    days,
  });
  return {
    contractVersion: 1,
    clientId: String(clientId),
    dateKey: data.dateKey,
    today: data.today,
    progress: data.progress,
    attention: {
      items: data.attention,
      count: data.attention.length,
    },
    weeklyCheckin: data.weeklyCheckin,
  };
};
