import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'

import { radius, spacing } from '../../theme'
import { useAppTheme } from '../../theme/useAppTheme'

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string
  error?: string
  hint?: string
  secure?: boolean
}

export function TextField({
  label,
  error,
  hint,
  secure = false,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {
  const { colors } = useAppTheme()
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false)

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.surface,
            borderColor: error
              ? colors.danger
              : focused
                ? colors.primary
                : colors.border,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.subtle}
          selectionColor={colors.primary}
          style={[styles.input, { color: colors.text }]}
          secureTextEntry={secure && !visible}
          onFocus={(event) => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            onBlur?.(event)
          }}
          {...props}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            hitSlop={8}
            onPress={() => setVisible((current) => !current)}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.muted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: colors.subtle }]}>{hint}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputWrap: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  error: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
  },
})
