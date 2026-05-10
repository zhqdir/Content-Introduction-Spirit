import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    // 导航栏
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: theme.backgroundRoot,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
    },
    navRight: {
      width: 60,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing['5xl'],
    },
    section: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      shadowColor: theme.shadowDark,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 4,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.5)',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    sectionIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(108,99,255,0.12)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    optionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    optionChip: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.6)',
    },
    optionChipSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    customTitleContainer: {
      marginTop: Spacing.md,
    },
    customTitleLabel: {
      marginBottom: Spacing.sm,
    },
    customTitleInputRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    customTitleInput: {
      flex: 1,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: 14,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.6)',
    },
    saveButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    voiceList: {
      gap: Spacing.sm,
    },
    voiceOption: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.6)',
    },
    voiceOptionSelected: {
      backgroundColor: 'rgba(108,99,255,0.12)',
      borderColor: theme.primary,
    },
    voiceOptionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    rateOptions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    rateOption: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.backgroundTertiary,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.6)',
    },
    rateOptionSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.lg,
      gap: Spacing.sm,
    },
    resetButtonText: {
      marginLeft: Spacing.xs,
    },
  });
};
