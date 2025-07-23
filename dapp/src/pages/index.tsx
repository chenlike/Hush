import { Link } from "@heroui/link";
import { Snippet } from "@heroui/snippet";
import { Code } from "@heroui/code";
import { Button } from "@heroui/button";
import { button as buttonStyles } from "@heroui/theme";
import { useNavigate } from 'react-router-dom';
import { siteConfig } from "@/config/site";
import { title, subtitle } from "@/components/primitives";
import { GithubIcon } from "@/components/icons";
import DefaultLayout from "@/layouts/default";

export default function IndexPage() {
  const navigate = useNavigate();
  function toTrade(){
    navigate("/trade");
  }
  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block max-w-4xl text-center justify-center">
          <div className={title({ class: "mt-18" })} >Trading Competition</div>
          <div className="mt-4">
            <span className={title()}>Built on&nbsp;</span>
            <span className={title({ color: "yellow" })}>ZAMA-FHE&nbsp;</span>
            <span className={title()}>
              Technology
            </span>
            <div className={subtitle({ class: "mt-8" })}>
              Secure and private trading platform <br /> powered by ZAMA's fully homomorphic encryption technology
            </div>
          </div>

        </div>

        <div className="flex gap-3">
          <Link
            isExternal
            className={buttonStyles({ variant: "bordered", radius: "full" })}
            href={siteConfig.links.github}
          >
            <GithubIcon size={20} />
            GitHub
          </Link>
          <Button color="primary" radius="full" onPress={toTrade}>Get Started</Button>


        </div>

      </section>
    </DefaultLayout>
  );
}
