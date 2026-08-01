import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

export default function NotFoundPage() {
  return (
    <section className="not-found">
      <span className="not-found-code">404</span>
      <h1 className="page-title">这个地址没有对应的页面</h1>
      <p className="page-sub">
        可能是链接拼错了，或者内容已经下线。从课程列表重新进入，或回工作台看看今天要学什么。
      </p>
      <div className="btn-row">
        <Link className="btn btn-primary" to="/">
          <Icon name="dashboard" size={16} />
          回工作台
        </Link>
        <Link className="btn btn-secondary" to="/courses">
          <Icon name="courses" size={16} />
          浏览课程
        </Link>
      </div>
    </section>
  );
}
