'use client';

import { useState } from 'react';
import {
  CREATOR_AD_FREQUENCY_LABELS,
  CREATOR_BLOCKABLE_AD_CATEGORIES,
  CREATOR_BLOCKABLE_AD_CATEGORY_LABELS,
  updateCreatorSettings,
  type CreatorAdFrequency,
  type CreatorProfile,
} from '@/entities/creator';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import styles from './CreatorSettingsSection.module.scss';

export interface CreatorSettingsSectionProps {
  profile: CreatorProfile;
  onSaved: (profile: CreatorProfile) => void;
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function CreatorSettingsSection({ profile, onSaved }: CreatorSettingsSectionProps) {
  const [monetizationEnabled, setMonetizationEnabled] = useState(profile.monetizationEnabled);
  const [adFrequency, setAdFrequency] = useState<CreatorAdFrequency>(profile.adFrequency);
  const [maxAdFrequencyRatio, setMaxAdFrequencyRatio] = useState(
    String(profile.maxAdFrequencyRatio),
  );
  const [blockedCategories, setBlockedCategories] = useState<string[]>(profile.blockedCategories);
  const [blockedAdvertiserIds, setBlockedAdvertiserIds] = useState<string[]>(
    profile.blockedAdvertiserIds,
  );
  const [newAdvertiserId, setNewAdvertiserId] = useState('');
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    const ratio = Number(maxAdFrequencyRatio);
    if (!Number.isInteger(ratio) || ratio < 1 || ratio > 20) {
      setError('Частота должна быть целым числом от 1 до 20');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await updateCreatorSettings({
        monetizationEnabled,
        adFrequency,
        maxAdFrequencyRatio: ratio,
        blockedCategories,
        blockedAdvertiserIds,
      });
      onSaved(next);
      setSaved(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Не удалось сохранить настройки',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.section}>
      <Card className={styles.card}>
        <h2 className={styles.title}>Монетизация</h2>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={monetizationEnabled}
            onChange={(event) => setMonetizationEnabled(event.target.checked)}
          />
          Разрешить показ рекламы в моём контенте
        </label>
      </Card>

      <Card className={styles.card}>
        <h2 className={styles.title}>Частота рекламы</h2>
        <label className={styles.field}>
          <span className={styles.label}>Уровень</span>
          <select
            className={styles.input}
            value={adFrequency}
            onChange={(event) => setAdFrequency(event.target.value as CreatorAdFrequency)}
          >
            {(Object.entries(CREATOR_AD_FREQUENCY_LABELS) as [CreatorAdFrequency, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Не чаще 1 рекламы на N постов</span>
          <input
            type="number"
            min={1}
            max={20}
            className={styles.input}
            value={maxAdFrequencyRatio}
            onChange={(event) => setMaxAdFrequencyRatio(event.target.value)}
          />
        </label>
      </Card>

      <Card className={styles.card}>
        <h2 className={styles.title}>Запрещённые категории рекламы</h2>
        <p className={styles.hint}>
          Реклама из этих категорий никогда не появится в вашем контенте.
        </p>
        <div className={styles.checkboxGroup}>
          {CREATOR_BLOCKABLE_AD_CATEGORIES.map((category) => (
            <label key={category} className={styles.checkboxOption}>
              <input
                type="checkbox"
                checked={blockedCategories.includes(category)}
                onChange={() => setBlockedCategories((prev) => toggle(prev, category))}
              />
              {CREATOR_BLOCKABLE_AD_CATEGORY_LABELS[category]}
            </label>
          ))}
        </div>
      </Card>

      <Card className={styles.card}>
        <h2 className={styles.title}>Заблокированные рекламодатели</h2>
        <p className={styles.hint}>
          Реклама от этих компаний не будет показана вам — доступно, когда появятся рекламодатели.
        </p>
        <div className={styles.row}>
          <input
            type="text"
            className={styles.input}
            placeholder="ID компании"
            value={newAdvertiserId}
            onChange={(event) => setNewAdvertiserId(event.target.value)}
          />
          <Button
            variant="outline"
            type="button"
            disabled={!newAdvertiserId.trim()}
            onClick={() => {
              setBlockedAdvertiserIds((prev) => toggle(prev, newAdvertiserId.trim()));
              setNewAdvertiserId('');
            }}
          >
            Добавить
          </Button>
        </div>
        {blockedAdvertiserIds.length > 0 && (
          <ul className={styles.list}>
            {blockedAdvertiserIds.map((id) => (
              <li key={id} className={styles.listItem}>
                <span className={styles.listItemText}>{id}</span>
                <button
                  type="button"
                  className={styles.listItemRemove}
                  onClick={() =>
                    setBlockedAdvertiserIds((prev) => prev.filter((item) => item !== id))
                  }
                >
                  Убрать
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {saved && !error && <p className={styles.saved}>Настройки сохранены</p>}

      <Button disabled={isSaving} onClick={() => void handleSave()}>
        {isSaving ? 'Сохраняем…' : 'Сохранить настройки'}
      </Button>
    </div>
  );
}
