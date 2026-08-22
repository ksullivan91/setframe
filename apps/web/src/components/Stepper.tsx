import styled from 'styled-components';
import { Check } from 'lucide-react';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/typeScale';

export interface StepperStep {
  key: string;
  title: string;
  description?: string;
}

interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
}

const List = styled.ol`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: ${spacing[12]}px;
  list-style: none;
  margin: 0;
  padding: 0;
`;

const Item = styled.li<{ $state: 'complete' | 'current' | 'upcoming' }>`
  display: flex;
  gap: ${spacing[12]}px;
  align-items: flex-start;
  padding: ${spacing[12]}px;
  border-radius: ${radius.large}px;
  border: 1px solid
    ${(p) =>
      p.$state === 'current'
        ? p.theme.action.primary
        : p.$state === 'complete'
          ? `${p.theme.action.primary}55`
          : p.theme.border.subtle};
  background: ${(p) =>
    p.$state === 'current' || p.$state === 'complete'
      ? p.theme.action.accentSubtle
      : p.theme.surface.raised};
`;

const Marker = styled.span<{ $state: 'complete' | 'current' | 'upcoming' }>`
  display: inline-flex;
  width: 28px;
  height: 28px;
  border-radius: ${radius.full}px;
  align-items: center;
  justify-content: center;
  font-size: ${typeScale.label.fontSize}px;
  font-weight: 700;
  flex-shrink: 0;
  border: 1px solid
    ${(p) => (p.$state === 'upcoming' ? p.theme.border.default : p.theme.action.primary)};
  background: ${(p) => (p.$state === 'upcoming' ? p.theme.surface.raised : p.theme.action.primary)};
  color: ${(p) => (p.$state === 'upcoming' ? p.theme.text.secondary : p.theme.action.primaryText)};
`;

const Text = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
`;

const Title = styled.span`
  font-size: ${typeScale.compactBody.fontSize}px;
  font-weight: 600;
`;

const Description = styled.span`
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.caption.fontSize}px;
  line-height: 1.4;
`;

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <List aria-label="Program creation progress">
      {steps.map((step, index) => {
        const state = index < currentStep ? 'complete' : index === currentStep ? 'current' : 'upcoming';
        return (
          <Item key={step.key} $state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <Marker $state={state}>{state === 'complete' ? <Check size={16} aria-hidden="true" /> : index + 1}</Marker>
            <Text>
              <Title>{step.title}</Title>
              {step.description ? <Description>{step.description}</Description> : null}
            </Text>
          </Item>
        );
      })}
    </List>
  );
}
