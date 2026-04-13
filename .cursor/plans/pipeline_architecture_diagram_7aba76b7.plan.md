---
name: Pipeline architecture diagram
overview: Visual diagram of the full DSP-to-trading pipeline showing how raw price becomes trading decisions.
todos: []
isProject: false
---

# SBN Pipeline Architecture

## Signal Processing Pipeline (Perception)

```mermaid
flowchart TD
  subgraph input [1. Input Signal]
    price["Raw Price (1m bars)"] --> logRet["Log Returns"]
    logRet --> denoise["Haar Wavelet Denoise + MAD"]
    denoise --> cleanBars["cleanBars (denoised returns)"]
  end

  subgraph freq [2. Frequency Detection]
    cleanBars --> goertzel["Goertzel Bank (causal, exponential decay)"]
    cleanBars --> batchDFT["Batch DFT (periodic sanity check)"]
    goertzel --> peakK["Peak frequency kFrac"]
    batchDFT --> sanity["Sanity: divergence check"]
    peakK --> tDomRaw["tDom raw = refLength / kFrac"]
    sanity -->|"reseed / blend / accept"| tDomRaw
    tDomRaw --> gate["gateTdom (EMA + hysteresis + dwell)"]
    gate --> tDom["tDomAccepted (8-80 bars)"]
  end

  subgraph embed [3. Phase Extraction]
    tDom --> tau["Frozen tau (delay)"]
    tDom --> dim["Frozen m (embedding dim)"]
    cleanBars --> takens["Takens Embedding: v_t = (x_t, x_t-tau, x_t-2tau, ...)"]
    tau --> takens
    dim --> takens
    takens --> pca["PCA: project m-D to 2D plane"]
    pca --> rawPhase["Raw phase angle = atan2(v dot e2, v dot e1)"]
    pca --> procrustes["Procrustes alignment to previous basis"]
    procrustes --> stablePhase["Stable phase series (no basis-flip jumps)"]
  end

  subgraph vm [4a. Von Mises Filter]
    stablePhase --> vmFilter["Exponential-weighted circular smoother"]
    tDom --> omega["Expected advance: omega = 2pi / tDom"]
    omega --> demod["Demodulate: subtract expected advance per bar"]
    vmFilter --> demod
    demod --> rBar["rBar (residual coherence)"]
    rBar --> ppc["PPC = (N R^2 - 1) / (N - 1)"]
    rBar --> kappa["kappa = kappaFromRbar(rBar)"]
    vmFilter --> mu["mu (smoothed mean direction)"]
  end

  subgraph hmm [4b. HMM Regime Classification]
    mu --> hmmForward["HMM Forward: P(state | mu, kappa, history)"]
    kappa --> hmmForward
    tDom --> hmmTransition["Transition matrix A (dwell = tDom/4)"]
    hmmTransition --> hmmForward
    hmmForward --> alpha["alpha = (P_rising, P_peak, P_falling, P_trough)"]
    alpha --> regime["regimeId = argmax(alpha) x 2 + direction"]
  end

  subgraph clock [4c. Smooth Clock]
    mu --> springClock["Damped spring model"]
    tDom --> springClock
    springClock --> clockPos["Clock position (0-1)"]
    springClock --> clockVel["Clock velocity"]
    clockVel --> clockAccel["Clock acceleration"]
  end
```

## Trading Decision Pipeline

```mermaid
flowchart TD
  subgraph topology [Topology Quality Gate]
    embVecs["Embedding vectors (3D PCA)"] --> winding["Winding number"]
    embVecs --> closure["Loop closure"]
    embVecs --> stability["Topology stability (CV of invariants)"]
    winding --> topoScore["Topology score (weighted composite)"]
    closure --> topoScore
    stability --> topoScore
    topoScore --> topoClass["Class: stable_loop / unstable_loop / drift / chaotic"]
  end

  subgraph hurst_gate [Hurst Regime Gate]
    cleanBars2["cleanBars"] --> hurstCalc["R/S Hurst exponent"]
    hurstCalc --> hurstVal["H < 0.5: cyclic | H > 0.55: trending"]
  end

  subgraph entry [shouldEnter Checklist]
    cooldown{"Cooldown expired?"} -->|yes| hmmConf{"HMM alpha > min_confidence?"}
    hmmConf -->|yes| topoGate{"Topology score > 0.3?"}
    topoGate -->|yes| turningCheck{"Is turning point (peak/trough)?"}
    turningCheck -->|yes| kappaGate{"Kappa > 1.5 for 3+ bars?"}
    turningCheck -->|no| velGate
    kappaGate -->|yes| hurstGate2{"Hurst < 0.55?"}
    hurstGate2 -->|yes| velGate{"Clock velocity > threshold?"}
    velGate -->|yes| dirCheck{"Velocity matches trade direction?"}
    dirCheck -->|yes| accelCheck{"Acceleration confirms turn?"}
    accelCheck -->|yes| enterTrade["ENTER TRADE"]
  end

  subgraph gp [GP/UCB Parameter Optimization]
    enterTrade --> ucb["UCB selects parameter vector"]
    ucb --> params["entry_thr, size, stop, exit_phase, cooldown, min_conf"]
    params --> openPos["Open position with optimized params"]
    openPos --> ride["Ride the quarter-cycle"]
    ride --> exitCheck{"Exit condition met?"}
    exitCheck -->|"phase target"| close["Close trade"]
    exitCheck -->|"regime flip"| close
    exitCheck -->|"stop loss"| close
    exitCheck -->|"topology collapse"| close
    close --> reward["Compute reward (return + risk + efficiency + alignment)"]
    reward --> gpUpdate["GP learns: param_vector -> reward"]
    gpUpdate -->|"next trade uses better params"| ucb
  end
```

## Key Numbers at Each Stage

- **Input**: ~2048 event bars max, 256 lookback for DFT
- **Frequency**: tDom range 8-80 bars (was 200, lowered to prevent cascade failure)
- **Embedding**: m=3-6 dimensions, tau=2-20 bars, span=(m-1)*tau bars
- **Phase window**: 2.5 x tDom bars of phase history
- **VM horizon**: 0.55 x tDom bars (exponential weighting)
- **HMM dwell**: tDom/4 bars per state minimum
- **Clock spring**: damping 0.93, max velocity 0.035 per bar
- **Trading**: 8 regime-specific GP models, 6 parameters each, UCB exploration
