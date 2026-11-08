import { Link } from 'react-router-dom';
import { Empty, Button } from '../components/ui';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <Empty
      icon={<Compass className="h-10 w-10" />}
      title="页面不存在"
      description="这个地址没有对应的内容，可能是链接已失效。"
      action={
        <Link to="/">
          <Button>返回首页</Button>
        </Link>
      }
    />
  );
}
