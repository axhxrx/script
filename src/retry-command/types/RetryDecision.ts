/**
 The outcome of evaluating `ifPatterns` / `unlessPatterns` against a failed attempt's output.
 */
export interface RetryDecision
{
  /**
   `true` if another attempt should be made, `false` to give up.
   */
  retry: boolean;

  /**
   Present when `retry` is `false` and a pattern rule drove the decision.
   */
  skipReason?: string;
}
