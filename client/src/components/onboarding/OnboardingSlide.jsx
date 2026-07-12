import { forwardRef } from "react";

const OnboardingSlide = forwardRef(function OnboardingSlide({ slide, index }, ref) {
  return (
    <section className="onboarding-slide" aria-labelledby={`onboarding-title-${index}`}>
      <img className="onboarding-illustration" src={slide.image} alt={slide.alt} width="640" height="360" />
      <div className="mt-5">
        <h1 ref={ref} id={`onboarding-title-${index}`} tabIndex="-1" className="text-2xl font-black text-farm-950 focus:outline-none sm:text-3xl dark:text-white">{slide.title}</h1>
        <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">{slide.description}</p>
      </div>
    </section>
  );
});

export default OnboardingSlide;
