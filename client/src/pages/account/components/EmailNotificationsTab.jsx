import { Mail, Sunrise } from "lucide-react";
import { useTranslation } from "react-i18next";

import { NotificationPreferences } from "../../../components/NotificationPreferences";

const EmailNotificationsTab = ({ userId }) => {
  const { t } = useTranslation("account");

  return (
    <section className="animate-tab-fade" aria-labelledby="email-reminder-title">
      <header className="mb-6 border-b border-white/10 pb-4">
        <h2
          id="email-reminder-title"
          className="text-xl font-bold uppercase text-white"
        >
          {t("email_reminders.title")}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">
          {t("email_reminders.desc")}
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gray-800/30 shadow-xl">
        <div className="flex items-start gap-4 border-b border-white/10 p-5 sm:p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
            <Sunrise className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-bold text-white">
              {t("email_reminders.morning_title")}
            </h3>
            <p className="mt-1 text-sm leading-6 text-gray-400">
              {t("email_reminders.morning_desc")}
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-300">
            <Mail className="h-4 w-4 text-orange-300" aria-hidden="true" />
            <span>{t("email_reminders.recipient_note")}</span>
          </div>
          <NotificationPreferences userId={userId} channel="email" />
          <p className="mt-4 text-xs leading-5 text-gray-500">
            {t("email_reminders.eligibility_note")}
          </p>
        </div>
      </div>
    </section>
  );
};

export default EmailNotificationsTab;
