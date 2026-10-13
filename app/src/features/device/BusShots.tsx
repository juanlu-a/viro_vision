/**
 * Bus mode's pictures on Home: for each bus, the frame it was detected in and every banner crop the
 * OCR read, with what it returned and what was said. The supermarket's photo-behind-the-reading, for
 * the mode that reads on its own.
 *
 * TEMPORARY — DEVELOPMENT ONLY, removed before the final version with the rest of the evidence path
 * (`services/evidence`, `docs/ROADMAP.md`).
 *
 * Under `features/device` because that is where the evidence path is wired (ADR 0001's boundary keeps
 * it out of recognition and the announcement). Every picture goes after its text, as on Home: the
 * screen reader reaches what can be read first.
 */
import { Image } from 'expo-image';
import { useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { strings } from '@/i18n';
import { gallery, type BusShot } from '@/services/evidence';

function decision(shot: BusShot): string {
  const r = strings.reader;
  if (!shot.decided) return r.busShotUndecided;
  const what = [shot.decided.number, shot.decided.destination].filter(Boolean).join(' ') || r.fieldUnread;
  return shot.decided.announced ? `${r.busShotDecided}: ${what}` : `${r.busShotSilenced}: ${what}`;
}

function Shot({ shot }: { shot: BusShot }) {
  const r = strings.reader;
  const title = `${r.busShotTitle} ${shot.track}${shot.time ? ` ${r.busShotAt} ${shot.time}` : ''}`;
  return (
    <View className="gap-two border-t border-border pt-three">
      <View accessible accessibilityRole="header" accessibilityLabel={`${title}. ${decision(shot)}`}>
        <ThemedText type="default" className="font-sans-bold">
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {decision(shot)}
        </ThemedText>
      </View>
      {shot.busUri && (
        <Image
          source={{ uri: shot.busUri }}
          style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md }}
          contentFit="contain"
          accessibilityLabel={r.busShotFrame}
        />
      )}
      {shot.reads.map((read) => {
        const ocr = `${r.busShotOcr} ${read.attempt}: ${read.text || r.busShotOcrNothing}`;
        return (
          <View key={read.attempt} className="gap-one">
            <ThemedText type="small" themeColor={read.text ? undefined : 'textSecondary'}>
              {ocr}
            </ThemedText>
            {read.cropUri && (
              <Image
                source={{ uri: read.cropUri }}
                style={{ width: '100%', height: 96, borderRadius: Radius.md }}
                contentFit="contain"
                accessibilityLabel={`${r.busShotCrop} ${read.attempt}.`}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

export function BusShots() {
  const shots = useSyncExternalStore(gallery.subscribe, gallery.get, gallery.get);
  const r = strings.reader;
  return (
    <View className="gap-two">
      <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
        {r.busShotsLabel.toUpperCase()}
      </ThemedText>
      {shots.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {r.busShotsEmpty}
        </ThemedText>
      ) : (
        shots.map((shot) => <Shot key={shot.key} shot={shot} />)
      )}
    </View>
  );
}
